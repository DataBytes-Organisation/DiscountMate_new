"""
Recipe RAG Pipeline — local sentence-transformers retrieval +
cascading LLM generation (OpenRouter → HuggingFace fallback).

Loaded by Flask app.py at startup. One model + one index in memory,
serves many concurrent users via per-session conversation history.

Product matching is grounded in live MongoDB product documents.
The embedding index is used only as a lookup aid; product names and
images always come from MongoDB so the LLM never hallucinates products.
"""

import json
import os
import re
import time
import uuid
from typing import Dict, List, Optional

import numpy as np
import requests
from dotenv import load_dotenv
from rank_bm25 import BM25Okapi

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None
    print("WARNING: sentence-transformers not installed. "
          "Run: pip install sentence-transformers")

try:
    from .gcs_loader import ensure_index_file   # Flask package
except ImportError:
    from gcs_loader import ensure_index_file    # CLI direct run

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Locate Backend/.env (2 levels up from this file:
#   DiscountMate_new/Backend/ml-service/recipe_rag/rag_pipeline.py
#   → DiscountMate_new/Backend/.env)
_BACKEND_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)
_ENV_PATH = os.path.join(_BACKEND_ROOT, ".env")
if os.path.exists(_ENV_PATH):
    load_dotenv(_ENV_PATH, override=False)
    print(f"[env] loaded {_ENV_PATH}")
else:
    load_dotenv(override=True)
    print(f"[env] no .env at {_ENV_PATH} — fell back to cwd search")

EMBEDDING_MODEL_NAME = "all-mpnet-base-v2"
INDEX_DIR = os.path.join(os.path.dirname(__file__), "index")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
HUGGINGFACE_URL = "https://router.huggingface.co/v1/chat/completions"

OPENROUTER_API_KEY = os.getenv("OPEN_ROUTER_API_KEY", "").strip().strip('"')
HF_TOKEN = os.getenv("HUGGING_FACE_TOKEN", "").strip().strip('"')
MONGO_URI = os.getenv("MONGO_URI", "").strip()
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "DiscountMate_DB")

INGREDIENT_UNITS = {
    "g", "kg", "mg", "ml", "l", "cup", "cups", "tbs", "tbsp", "tablespoon",
    "tablespoons", "tsp", "teaspoon", "teaspoons", "pinch", "pkt", "packet",
    "packets", "pack", "packs", "can", "cans", "slice", "slices", "whole",
    "handful", "bunch", "clove", "cloves", "sprig", "sprigs", "each",
}

INGREDIENT_NOISE_WORDS = {
    "fresh", "large", "small", "medium", "whole", "half", "halved", "diced",
    "chopped", "sliced", "finely", "thinly", "roughly", "coarsely", "crushed",
    "grated", "drained", "rinsed", "peeled", "pitted", "toasted", "cooked",
    "reserved", "optional", "decorate", "garnish", "serve", "serving",
    "style", "approved", "woolworths", "coles", "macro", "rspca", "brand",
    "extra", "hot", "cold", "warm", "salt", "added", "no", "as", "per",
    "instruction", "instructions", "cook",
}

PRODUCT_BAD_WORDS = {
    "cat", "dog", "kitten", "puppy", "pet", "treat", "treats", "litter",
    "dental", "bird", "laundry", "cleaner", "cleaning", "detergent",
}

BAD_PRODUCT_CATEGORIES = {
    "pet food & accessories", "household items", "health & beauty",
    "baby food & accessories", "alcohol", "beverages",
    "snacks & confectionary",
}

OPENROUTER_MODELS = [
    "nvidia/nemotron-nano-12b-v2-vl:free",      # fast, instruction-tuned
    "nvidia/nemotron-3-super-120b-a12b:free",   # best quality
    "nvidia/nemotron-3-nano-30b-a3b:free",      # fallback
]

HF_MODELS = [
    "MiniMaxAI/MiniMax-M2.7",
    "openai/gpt-oss-120b",
    "Qwen/Qwen2.5-7B-Instruct",
    "meta-llama/Llama-3.1-8B-Instruct",
]

MAX_TURNS_PER_SESSION = 3
MATCH_CACHE_TTL_SECONDS = 30 * 60
MATCH_CACHE_MAX = 2000
CONTEXT_STORE_TTL_SECONDS = 30 * 60

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

CHAT_SYSTEM_PROMPT = """You are DiscountMate's recipe assistant. You ONLY help \
users find, plan, and cook recipes from the provided recipe context.

STRICT RULES:
- ONLY answer questions about recipes, ingredients, cooking, meal planning,
  or shopping for the recipes shown in your context.
- If the user asks about anything else (chit-chat, news, code, jokes,
  personal advice, politics, etc.), reply briefly:
  "I can only help with recipe and cooking questions from DiscountMate's
  recipe collection. What would you like to cook?"
- NEVER invent recipes that are not in the provided context.
- NEVER mention the source retailer (e.g. "Woolworths") in your answer
  unless the user explicitly asks where the recipe came from.
- When the user asks for a recipe in full, or to "show me", you MUST output:
    1. The recipe name (bold)
    2. Prep time, cook time, servings
    3. The COMPLETE ingredient list with exact quantities (every line)
    4. The COMPLETE numbered step-by-step instructions (every step, in order)
- When listing multiple recipes, give name + 1-line summary + key ingredients,
  and tell the user they can ask for any one in full.
- When an "Available products" list is provided, only suggest those products
  as shopping options. Do not suggest or invent any products not in that list.
- Be friendly and concise. Do NOT say "let me know if you'd like more" —
  the user can always ask follow-ups."""


# ---------------------------------------------------------------------------
# MongoDB product resolver
# ---------------------------------------------------------------------------

class MongoProductResolver:
    """
    Connects to MongoDB and resolves product candidates to live product documents.
    Used to ground LLM product references in real database entries.

    The product embedding index was built from CSV metadata where product_id
    does not match MongoDB products.product_code. Barcode is the strongest
    join key because it maps to products.gtin in the current MongoDB data.
    """

    def __init__(self):
        self._products_col = None
        self._pricings_col = None
        self._category_code_by_id: Dict[str, str] = {}
        self.enabled = False
        self._description_cache: Dict[str, Optional[Dict]] = {}
        self._bm25 = None
        self._bm25_docs: List[Dict] = []
        self._bm25_rank_by_query: Dict[str, Dict[str, int]] = {}
        self._try_connect()

    def _try_connect(self):
        if not MONGO_URI:
            print("[MongoProductResolver] MONGO_URI not set — product grounding disabled")
            return
        try:
            from pymongo import MongoClient
            client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            client.admin.command("ping")
            db = client[MONGO_DB_NAME]
            self._products_col = db["products"]
            self._pricings_col = db["product_pricings"]
            self._category_code_by_id = {
                str(c["_id"]): str(c.get("category_code", "")).lower()
                for c in db["categories"].find({}, {"category_code": 1})
            }
            self._build_bm25_index()
            self.enabled = True
            print(f"[MongoProductResolver] connected to {MONGO_DB_NAME}")
        except Exception as e:
            print(f"[MongoProductResolver] connection failed: {e} — product grounding disabled")

    def _normalize_token(self, token: str) -> str:
        token = token.lower().strip("'")
        if len(token) > 3 and token.endswith("ies"):
            return token[:-3] + "y"
        if len(token) > 3 and token.endswith("oes"):
            return token[:-2]
        if len(token) > 4 and token.endswith(("ses", "xes", "ches", "shes")):
            return token[:-2]
        if len(token) > 3 and token.endswith("s"):
            return token[:-1]
        return token

    def _tokens_from_text(self, text: str) -> List[str]:
        return [
            self._normalize_token(t)
            for t in re.findall(r"[a-zA-Z][a-zA-Z']+", str(text or "").lower())
        ]

    def _product_name(self, doc: Dict) -> str:
        return (
            doc.get("product_name")
            or doc.get("name")
            or doc.get("item_name")
            or ""
        )

    def _is_recipe_product_candidate(self, doc: Dict) -> bool:
        product_tokens = set(self._tokens_from_text(
            f"{self._product_name(doc)} {doc.get('product_code') or ''}"
        ))
        category_code = self._category_code_by_id.get(str(doc.get("category_id")), "")
        return not (
            PRODUCT_BAD_WORDS & product_tokens
            or category_code in BAD_PRODUCT_CATEGORIES
            or ("food" in product_tokens and ({"cat", "dog", "pet"} & product_tokens))
        )

    def _bm25_tokens_for_doc(self, doc: Dict) -> List[str]:
        category_code = self._category_code_by_id.get(str(doc.get("category_id")), "")
        return self._tokens_from_text(f"{self._product_name(doc)} {category_code}")

    def _build_bm25_index(self):
        if self._products_col is None:
            return
        projection = {
            "product_name": 1, "name": 1, "item_name": 1,
            "product_code": 1, "product_id": 1, "gtin": 1,
            "category_id": 1, "link_image": 1, "image": 1,
        }
        try:
            docs = []
            corpus = []
            for doc in self._products_col.find({}, projection).max_time_ms(15000):
                if not self._product_name(doc) or not self._is_recipe_product_candidate(doc):
                    continue
                tokens = self._bm25_tokens_for_doc(doc)
                if not tokens:
                    continue
                docs.append(doc)
                corpus.append(tokens)

            self._bm25_docs = docs
            self._bm25 = BM25Okapi(corpus) if corpus else None
            print(f"[MongoProductResolver] BM25 indexed {len(self._bm25_docs)} products")
        except Exception as e:
            print(f"[MongoProductResolver] BM25 index unavailable: {e}")
            self._bm25 = None
            self._bm25_docs = []

    def _bm25_ranked_docs(self, query_tokens: List[str], limit: int = 20) -> List[Dict]:
        if self._bm25 is None or not query_tokens:
            return []
        scores = self._bm25.get_scores(query_tokens)
        if len(scores) == 0:
            return []
        order = np.argsort(scores)[::-1]
        ranked = []
        rank_map: Dict[str, int] = {}
        for idx in order:
            score = float(scores[int(idx)])
            if score <= 0:
                break
            doc = self._bm25_docs[int(idx)]
            mongo_id = str(doc["_id"])
            rank_map[mongo_id] = len(rank_map) + 1
            if len(ranked) < limit:
                ranked.append(doc)
        self._bm25_rank_by_query[" ".join(query_tokens)] = rank_map
        return ranked

    def _bm25_rank_for_doc(self, query_tokens: List[str], mongo_id: str) -> Optional[int]:
        query_key = " ".join(query_tokens)
        if query_key not in self._bm25_rank_by_query:
            self._bm25_ranked_docs(query_tokens, limit=20)
        return self._bm25_rank_by_query.get(query_key, {}).get(mongo_id)

    def _rrf_score(
        self,
        vector_rank: Optional[int],
        bm25_rank: Optional[int],
        k: int = 60,
    ) -> float:
        score = 0.0
        if vector_rank is not None:
            score += 1.0 / (k + vector_rank)
        if bm25_rank is not None:
            score += 1.0 / (k + bm25_rank)
        return score

    def _ingredient_search_terms(self, ingredient: str) -> List[str]:
        """
        Convert recipe lines like "400g chicken breasts, diced" into Mongo
        product-name search terms. The original ingredient is never used as
        display text; this only helps find live MongoDB products.
        """
        text = str(ingredient or "").lower()
        text = re.sub(r"\([^)]*\)", " ", text)
        text = re.split(r",|;", text, maxsplit=1)[0]
        text = re.sub(r"\b\d+([./]\d+)?\b", " ", text)
        text = re.sub(r"\b\d+(\.\d+)?\s*(g|kg|mg|ml|l)\b", " ", text)
        text = re.sub(r"[^a-zA-Z' ]+", " ", text)

        tokens = []
        for token in self._tokens_from_text(text):
            if token in INGREDIENT_UNITS or token in INGREDIENT_NOISE_WORDS:
                continue
            if len(token) < 2:
                continue
            tokens.append(token)

        if not tokens:
            return []

        terms = [" ".join(tokens)]
        if "stir" in tokens and "fry" in tokens and "vegetable" in tokens:
            terms.extend(["vegetable stir fry", "stir fry vegetable"])
        if len(tokens) > 2:
            terms.append(" ".join(tokens[-2:]))
        if len(tokens) > 1:
            terms.append(" ".join(tokens[:2]))
        terms.extend(tokens)
        return list(dict.fromkeys(t for t in terms if len(t) >= 3))

    def _find_product_by_ingredient(self, ingredient: str) -> Optional[Dict]:
        if not self.enabled:
            return None
        assert self._products_col is not None

        for term in self._ingredient_search_terms(ingredient):
            cache_key = f"ingredient:{term}"
            if cache_key in self._description_cache:
                return self._description_cache[cache_key]

            tokens = self._tokens_from_text(term)
            if not tokens:
                continue

            ranked_docs = self._bm25_ranked_docs(tokens, limit=1)
            if not ranked_docs:
                self._description_cache[cache_key] = None
                continue

            self._description_cache[cache_key] = ranked_docs[0]
            return ranked_docs[0]
        return None

    def _value_variants(self, values: List[str]) -> List:
        """Return string and int variants for each value (MongoDB stores both)."""
        variants: List = []
        for value in values:
            if value is None:
                continue
            s = str(value).strip()
            if not s:
                continue
            variants.append(s)
            try:
                variants.append(int(s))
            except (ValueError, TypeError):
                pass
        return variants

    def _positive_price(self, value) -> Optional[float]:
        try:
            val = float(value)
            return val if val > 0 else None
        except (TypeError, ValueError):
            return None

    def _build_candidate_filter(self, candidates: List[Dict]) -> Dict:
        barcodes = [
            str(c.get("barcode", "")).strip()
            for c in candidates
            if str(c.get("barcode", "")).strip() not in ("", "0")
        ]
        legacy_ids = [
            str(c.get("product_id", "")).strip()
            for c in candidates
            if str(c.get("product_id", "")).strip()
        ]

        clauses = []
        if barcodes:
            clauses.append({"gtin": {"$in": self._value_variants(barcodes)}})
        if legacy_ids:
            variants = self._value_variants(legacy_ids)
            clauses.extend([
                {"product_code": {"$in": variants}},
                {"product_id": {"$in": variants}},
            ])

        if not clauses:
            return {"_id": {"$exists": False}}
        return clauses[0] if len(clauses) == 1 else {"$or": clauses}

    def _description_search_terms(self, description: str) -> List[str]:
        """
        Conservative fallback for product-index rows with barcode "0".
        Uses product_metadata only to search MongoDB, never as display text.
        """
        raw = str(description or "").strip()
        if not raw:
            return []

        head = re.split(r"[:|]", raw, maxsplit=1)[0]
        head = re.sub(r"\s+", " ", head).strip()
        head = re.sub(r"^(coles|woolworths|iga)\s+", "", head, flags=re.I)
        if len(head) < 3:
            return []

        terms = [head]
        words = head.split()
        if len(words) > 2:
            terms.append(" ".join(words[:2]))
        return list(dict.fromkeys(terms))

    def _append_display_doc(self, doc: Dict, result: List[Dict], seen_ids: set):
        mongo_id = str(doc["_id"])
        if mongo_id in seen_ids:
            return
        seen_ids.add(mongo_id)
        name = (
            doc.get("product_name")
            or doc.get("name")
            or doc.get("item_name")
            or ""
        )
        if not name:
            return
        result.append({
            "lookup": {
                "_id": mongo_id,
                "product_code": doc.get("product_code"),
                "product_id": doc.get("product_id"),
                "gtin": doc.get("gtin"),
            },
            "product_name": name,
            "_id": mongo_id,
        })

    def _display_item_from_doc(self, doc: Dict) -> Optional[Dict]:
        name = (
            doc.get("product_name")
            or doc.get("name")
            or doc.get("item_name")
            or ""
        )
        if not name:
            return None
        mongo_id = str(doc["_id"])
        return {
            "lookup": {
                "_id": mongo_id,
                "product_code": doc.get("product_code"),
                "product_id": doc.get("product_id"),
                "gtin": doc.get("gtin"),
            },
            "product_name": name,
            "_id": mongo_id,
        }

    def resolve_names(self, candidates: List[Dict]) -> List[Dict]:
        """
        Bulk-fetch product names from MongoDB by candidate gtin/code/id.
        Only returns documents that exist — candidates not found are discarded.
        """
        if not self.enabled or not candidates:
            return []
        assert self._products_col is not None
        try:
            query = self._build_candidate_filter(candidates)
            docs = list(self._products_col.find(
                query,
                {
                    "product_name": 1, "name": 1, "item_name": 1,
                    "product_code": 1, "product_id": 1, "gtin": 1,
                },
            ).max_time_ms(5000).limit(len(candidates) * 3))

            result = []
            seen_ids: set = set()
            for doc in docs:
                self._append_display_doc(doc, result, seen_ids)

            for candidate in candidates:
                barcode = str(candidate.get("barcode", "")).strip()
                if barcode not in ("", "0"):
                    continue
                for term in self._description_search_terms(candidate.get("description", "")):
                    cache_key = term.lower()
                    if cache_key in self._description_cache:
                        doc = self._description_cache[cache_key]
                    else:
                        doc = self._products_col.find_one(
                            {"product_name": re.compile(f"^{re.escape(term)}", re.I)},
                            {
                                "product_name": 1, "name": 1, "item_name": 1,
                                "product_code": 1, "product_id": 1, "gtin": 1,
                            },
                            max_time_ms=5000,
                        )
                        self._description_cache[cache_key] = doc
                    if doc:
                        self._append_display_doc(doc, result, seen_ids)
                        break
            return result
        except Exception as e:
            print(f"[MongoProductResolver] resolve_names error: {e}")
            return []

    def resolve_ingredients(self, ingredients: List[str], candidates: List[Dict]) -> List[Dict]:
        """
        Resolve recipe ingredient lines to MongoDB products.
        Uses embedding candidates first, then searches MongoDB directly from
        cleaned ingredient names to cover recipes where the old product index
        misses or cannot join to Mongo.
        """
        result = self.resolve_names(candidates)
        seen_ids = {str(p.get("_id")) for p in result}

        if not self.enabled:
            return result

        for ingredient in ingredients:
            doc = self._find_product_by_ingredient(ingredient)
            if doc:
                self._append_display_doc(doc, result, seen_ids)
        return result

    def resolve_ingredient_matches(
        self,
        ingredients: List[str],
        ingredient_candidates: Dict[str, Optional[Dict]],
    ) -> Dict:
        """
        Resolve each recipe ingredient line to at most one MongoDB product.
        Returns both a deduped products list and an ingredient->product match
        list so the answer can show original quantities plus Mongo product names.
        """
        products: List[Dict] = []
        matches: List[Dict] = []
        seen_ids: set = set()
        product_by_id: Dict[str, Dict] = {}

        for ingredient in ingredients:
            scored_items = []
            terms = self._ingredient_search_terms(ingredient)
            query_tokens = self._tokens_from_text(terms[0]) if terms else []

            candidate = ingredient_candidates.get(ingredient)
            if candidate:
                resolved = self.resolve_names([candidate])
                if resolved:
                    vector_item = resolved[0]
                    bm25_rank = self._bm25_rank_for_doc(
                        query_tokens,
                        str(vector_item["_id"]),
                    ) if query_tokens else None
                    vector_rank = int(candidate.get("rank", 1) or 1)
                    scored_items.append((
                        self._rrf_score(vector_rank, bm25_rank),
                        bm25_rank is not None,
                        -(bm25_rank or 10_000),
                        vector_item,
                    ))

            bm25_doc = self._find_product_by_ingredient(ingredient)
            bm25_item = self._display_item_from_doc(bm25_doc) if bm25_doc else None
            if bm25_item and query_tokens:
                bm25_rank = self._bm25_rank_for_doc(query_tokens, str(bm25_item["_id"]))
                scored_items.append((
                    self._rrf_score(None, bm25_rank),
                    False,
                    -(bm25_rank or 10_000),
                    bm25_item,
                ))

            if not scored_items:
                continue

            item = max(scored_items, key=lambda entry: entry[:3])[3]

            mongo_id = str(item["_id"])
            if mongo_id not in seen_ids:
                seen_ids.add(mongo_id)
                products.append(item)
                product_by_id[mongo_id] = item
            else:
                item = product_by_id[mongo_id]

            matches.append({
                "ingredient": ingredient,
                "product_name": item["product_name"],
                "lookup": item["lookup"],
            })

        return {"products": products, "matches": matches}

    def fetch_for_display(self, lookups: List[Dict]) -> List[Dict]:
        """
        Bulk-fetch product data + latest pricing for frontend display.
        Returns list of {product_id, product_name, price, image_url, product_url}.
        """
        if not self.enabled or not lookups:
            return []
        assert self._products_col is not None
        assert self._pricings_col is not None
        try:
            from bson import ObjectId

            object_ids = []
            codes = []
            gtins = []
            product_ids = []
            for lookup in lookups:
                raw_id = str(lookup.get("_id", "")).strip()
                if ObjectId.is_valid(raw_id):
                    object_ids.append(ObjectId(raw_id))
                if lookup.get("product_code") is not None:
                    codes.append(str(lookup.get("product_code")))
                if lookup.get("gtin") is not None:
                    gtins.append(str(lookup.get("gtin")))
                if lookup.get("product_id") is not None:
                    product_ids.append(str(lookup.get("product_id")))

            clauses = []
            if object_ids:
                clauses.append({"_id": {"$in": object_ids}})
            if codes:
                clauses.append({"product_code": {"$in": self._value_variants(codes)}})
            if gtins:
                clauses.append({"gtin": {"$in": self._value_variants(gtins)}})
            if product_ids:
                clauses.append({"product_id": {"$in": self._value_variants(product_ids)}})

            if not clauses:
                return []
            query = clauses[0] if len(clauses) == 1 else {"$or": clauses}

            docs = list(self._products_col.find(
                query,
                {
                    "product_name": 1, "name": 1, "item_name": 1,
                    "link_image": 1, "image": 1,
                    "image_link_side": 1, "image_link_back": 1,
                    "product_code": 1, "product_id": 1, "gtin": 1,
                    "current_price": 1, "price": 1, "best_price": 1,
                },
            ).max_time_ms(5000).limit(len(lookups) * 3))

            pricing_codes = [
                str(doc.get("product_code", "")).strip()
                for doc in docs
                if str(doc.get("product_code", "")).strip()
            ]
            pricing_product_ids = [str(doc["_id"]) for doc in docs]
            pricing_variants = self._value_variants(pricing_codes)
            product_id_variants = self._value_variants(pricing_product_ids)
            product_id_variants.extend(ObjectId(pid) for pid in pricing_product_ids)

            pricing_filters = []
            if pricing_variants:
                pricing_filters.append({"product_code": {"$in": pricing_variants}})
            if product_id_variants:
                pricing_filters.append({"product_id": {"$in": product_id_variants}})

            pricings = []
            if pricing_filters:
                pricing_query = (
                    pricing_filters[0]
                    if len(pricing_filters) == 1
                    else {"$or": pricing_filters}
                )
                pricings = list(self._pricings_col.find(
                    pricing_query,
                    {
                        "product_code": 1, "product_id": 1, "price": 1,
                        "date": 1, "created_at": 1,
                    },
                ).sort("date", -1).max_time_ms(5000).limit(max(len(docs) * 30, 1)))

            price_by_code: Dict[str, float] = {}
            price_by_product_id: Dict[str, float] = {}
            for pricing in pricings:
                val = self._positive_price(pricing.get("price"))
                if val is None:
                    continue
                code_key = str(pricing.get("product_code", "")).strip()
                product_id_key = str(pricing.get("product_id", "")).strip()
                if code_key and code_key not in price_by_code:
                    price_by_code[code_key] = val
                if product_id_key and product_id_key not in price_by_product_id:
                    price_by_product_id[product_id_key] = val

            result = []
            seen_ids: set = set()
            for doc in docs:
                mongo_id = str(doc["_id"])
                if mongo_id in seen_ids:
                    continue
                seen_ids.add(mongo_id)
                code = str(doc.get("product_code", ""))
                name = (
                    doc.get("product_name")
                    or doc.get("name")
                    or doc.get("item_name")
                    or "Unknown Product"
                )
                price = (
                    price_by_code.get(code)
                    or price_by_product_id.get(mongo_id)
                    or self._positive_price(doc.get("current_price"))
                    or self._positive_price(doc.get("price"))
                    or self._positive_price(doc.get("best_price"))
                )
                image_url = (
                    doc.get("link_image")
                    or doc.get("image")
                    or doc.get("image_link_side")
                    or doc.get("image_link_back")
                )
                result.append({
                    "product_id": mongo_id,
                    "product_name": name,
                    "price": price,
                    "image_url": image_url,
                    "product_url": f"/product/{mongo_id}",
                })
            return result
        except Exception as e:
            print(f"[MongoProductResolver] fetch_for_display error: {e}")
            return []


# ---------------------------------------------------------------------------
# LLM cascade (OpenRouter -> HuggingFace)
# ---------------------------------------------------------------------------

class LLMClient:
    """Cascading LLM client: OpenRouter free models → HuggingFace fallback."""

    def __init__(self,
                 openrouter_models: Optional[List[str]] = None,
                 hf_models: Optional[List[str]] = None,
                 temperature: float = 0.7,
                 max_tokens: int = 1500):
        self.openrouter_models = openrouter_models or OPENROUTER_MODELS
        self.hf_models = hf_models or HF_MODELS
        self.temperature = temperature
        self.max_tokens = max_tokens

        print(f"[LLMClient] OpenRouter key: "
              f"{'yes' if OPENROUTER_API_KEY else 'NO'}")
        print(f"[LLMClient] HuggingFace token: "
              f"{'yes' if HF_TOKEN else 'NO — fallback disabled'}")
        print(f"[LLMClient] Cascade: {len(self.openrouter_models)} OpenRouter "
              f"→ {len(self.hf_models)} HuggingFace")

    def _try_openrouter(self, messages: List[Dict]) -> Optional[str]:
        if not OPENROUTER_API_KEY:
            return None
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://discountmate.app",
            "X-Title": "DiscountMate RAG",
        }
        for model_name in self.openrouter_models:
            payload = {
                "model": model_name,
                "messages": messages,
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
            }
            try:
                r = requests.post(OPENROUTER_URL, headers=headers,
                                  json=payload, timeout=30)
                data = r.json()
            except (requests.RequestException, ValueError) as e:
                print(f"  [OpenRouter] {model_name} request failed: {e}")
                continue

            if r.status_code == 200:
                content = (data.get("choices", [{}])[0]
                           .get("message", {}).get("content"))
                if content:
                    print(f"  [OpenRouter] used: {model_name}")
                    return content
            elif r.status_code == 429:
                print(f"  [OpenRouter] {model_name} rate limited")
            else:
                print(f"  [OpenRouter] {model_name} error {r.status_code}")
        return None

    def _try_huggingface(self, messages: List[Dict]) -> Optional[str]:
        if not HF_TOKEN:
            print("  [HuggingFace] no token — skipping")
            return None
        headers = {
            "Authorization": f"Bearer {HF_TOKEN}",
            "Content-Type": "application/json",
        }
        for model_name in self.hf_models:
            payload = {
                "model": model_name,
                "messages": messages,
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
            }
            try:
                r = requests.post(HUGGINGFACE_URL, headers=headers,
                                  json=payload, timeout=45)
            except requests.RequestException as e:
                print(f"  [HuggingFace] {model_name} request failed: {e}")
                continue

            try:
                data = r.json()
            except ValueError:
                print(f"  [HuggingFace] {model_name} non-JSON "
                      f"(status {r.status_code})")
                continue

            if r.status_code == 200:
                content = (data.get("choices", [{}])[0]
                           .get("message", {}).get("content"))
                if content:
                    print(f"  [HuggingFace] used: {model_name}")
                    return content
            elif r.status_code in (429, 503):
                print(f"  [HuggingFace] {model_name} status {r.status_code}")
            else:
                err = data.get("error", data.get("message", "unknown"))
                print(f"  [HuggingFace] {model_name} error "
                      f"{r.status_code}: {err}")
        return None

    def generate(self, system_prompt: str, messages: List[Dict]) -> str:
        """Run the cascade. messages = [{role, content}, ...] (no system)."""
        full = [{"role": "system", "content": system_prompt}] + messages

        result = self._try_openrouter(full)
        if result:
            return result

        print("  All OpenRouter models exhausted — trying HuggingFace...")
        result = self._try_huggingface(full)
        if result:
            return result

        raise RuntimeError(
            "All LLM providers exhausted "
            f"({len(self.openrouter_models)} OpenRouter + "
            f"{len(self.hf_models)} HuggingFace). Try again in ~60s."
        )


# ---------------------------------------------------------------------------
# Recipe retrieval
# ---------------------------------------------------------------------------

class RecipeRetriever:
    """Loads recipe_index.npz + recipe_metadata.json and does cosine search."""

    def __init__(self, embedding_model, index_dir: str = INDEX_DIR):
        self.model = embedding_model
        self.index_dir = index_dir
        self.embeddings: Optional[np.ndarray] = None
        self._e_norm: Optional[np.ndarray] = None
        self.recipes: List[Dict] = []
        self._load()

    def _load(self):
        try:
            emb_path = ensure_index_file("recipe_index.npz", self.index_dir)
            meta_path = ensure_index_file("recipe_metadata.json", self.index_dir)
        except RuntimeError as e:
            raise FileNotFoundError(
                f"Recipe index unavailable (local + GCS both failed): {e}\n"
                "Run: python build_recipe_index.py — or check GCS auth."
            ) from e
        embeddings = np.load(emb_path)["embeddings"].astype(np.float32)
        with open(meta_path, "r", encoding="utf-8") as f:
            self.recipes = json.load(f)
        if embeddings.shape[0] != len(self.recipes):
            raise ValueError(
                f"Recipe index shape mismatch: {embeddings.shape[0]} embeddings "
                f"vs {len(self.recipes)} metadata entries — rebuild the index."
            )
        self._e_norm = embeddings / (
            np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-10
        )
        self.embeddings = embeddings
        print(f"[RecipeRetriever] loaded {len(self.recipes)} recipes "
              f"({self.embeddings.shape})")

    def search(self, query: str, top_k: int = 8) -> List[Dict]:
        q = self.model.encode([query], convert_to_numpy=True).astype(np.float32)
        q_norm = q / (np.linalg.norm(q, axis=1, keepdims=True) + 1e-10)
        sims = (self._e_norm @ q_norm.T).flatten()
        top_idx = np.argsort(sims)[::-1][:top_k]

        results = []
        for rank, i in enumerate(top_idx, 1):
            results.append({
                "rank": rank,
                "score": float(sims[i]),
                "text": self.recipes[i]["text"],
                "metadata": self.recipes[i]["metadata"],
                "index": int(i),
            })
        return results


# ---------------------------------------------------------------------------
# Product matching (embedding index — lookup aid only)
# ---------------------------------------------------------------------------

class ProductMatcher:
    """
    Loads product_index.npz + product_metadata.json if present.
    Acts as a lookup aid only: maps ingredient text → product_code candidates.
    Product names, prices, and images always come from MongoDB via
    MongoProductResolver — never from this index directly.

    Product embeddings are pre-normalized at load time and ingredient
    embeddings are batched to minimise per-call overhead.
    """

    def __init__(self, embedding_model, index_dir: str = INDEX_DIR,
                 threshold: float = 0.55):
        self.model = embedding_model
        self.index_dir = index_dir
        self.threshold = threshold

        self.embeddings: Optional[np.ndarray] = None
        self._e_norm: Optional[np.ndarray] = None   # pre-normalized at load time
        self.products: List[Dict] = []
        self._match_cache: Dict[str, Optional[Dict]] = {}  # ingredient → product candidate
        self._match_cache_created: Dict[str, float] = {}

        self.enabled = False
        self._try_load()

    def _prune_match_cache(self):
        if not self._match_cache:
            return
        now = time.time()
        expired = [
            key for key, created in self._match_cache_created.items()
            if now - created > MATCH_CACHE_TTL_SECONDS
        ]
        for key in expired:
            self._match_cache.pop(key, None)
            self._match_cache_created.pop(key, None)

        while len(self._match_cache) > MATCH_CACHE_MAX:
            oldest_key = next(iter(self._match_cache))
            self._match_cache.pop(oldest_key, None)
            self._match_cache_created.pop(oldest_key, None)

    def _try_load(self):
        try:
            emb_path = ensure_index_file("product_index.npz", self.index_dir)
            meta_path = ensure_index_file("product_metadata.json", self.index_dir)
        except RuntimeError as e:
            print(f"[ProductMatcher] product index unavailable "
                  f"(local + GCS both failed) — annotations DISABLED. {e}")
            return

        data = np.load(emb_path, allow_pickle=True)
        embeddings = data["embeddings"].astype(np.float32)
        with open(meta_path, "r", encoding="utf-8") as f:
            products = json.load(f)["products"]

        if embeddings.shape[0] != len(products):
            print(f"[ProductMatcher] WARNING: shape mismatch — "
                  f"{embeddings.shape[0]} embeddings vs {len(products)} metadata entries "
                  f"— product matching DISABLED")
            return

        self.products = products
        self.embeddings = embeddings
        # Pre-normalize once at startup — reused for every batch query
        self._e_norm = embeddings / (
            np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-10
        )
        self.enabled = True
        print(f"[ProductMatcher] loaded {len(self.products)} products "
              f"(pre-normalized; MongoDB grounding mode)")

    def batch_find_product_candidates(self, ingredients: List[str]) -> Dict[str, Optional[Dict]]:
        """
        Batch-encode ingredients and return {ingredient: candidate | None}.
        Previously matched ingredients are returned from cache.
        """
        if not self.enabled or not ingredients:
            return {ing: None for ing in ingredients}

        self._prune_match_cache()
        uncached = [ing for ing in ingredients if ing not in self._match_cache]
        if uncached:
            q = self.model.encode(uncached, convert_to_numpy=True).astype(np.float32)
            q_norm = q / (np.linalg.norm(q, axis=1, keepdims=True) + 1e-10)
            # (n_products, n_ingredients) — single matrix multiply for all ingredients
            sims = self._e_norm @ q_norm.T

            for i, ing in enumerate(uncached):
                col_sims = sims[:, i]
                best_idx = int(np.argmax(col_sims))
                best_score = float(col_sims[best_idx])
                if best_score >= self.threshold:
                    p = self.products[best_idx]
                    self._match_cache[ing] = {
                        "product_id": str(p.get("product_id", "")).strip(),
                        "barcode": str(p.get("barcode", "")).strip(),
                        "description": str(p.get("description", "")).strip(),
                        "rank": 1,
                    }
                else:
                    self._match_cache[ing] = None
                self._match_cache_created[ing] = time.time()

            self._prune_match_cache()

        return {ing: self._match_cache.get(ing) for ing in ingredients}

    def find_query_product_candidates(self, query: str, top_k: int = 20) -> List[Dict]:
        """
        Return product-index candidates for the user's query before generation.
        These candidates are still resolved through MongoDB before prompt use.
        """
        if not self.enabled or not query.strip():
            return []
        q = self.model.encode([query], convert_to_numpy=True).astype(np.float32)
        q_norm = q / (np.linalg.norm(q, axis=1, keepdims=True) + 1e-10)
        sims = (self._e_norm @ q_norm.T).flatten()
        top_idx = np.argsort(sims)[::-1][:top_k]

        candidates = []
        for idx in top_idx:
            p = self.products[int(idx)]
            candidates.append({
                "product_id": str(p.get("product_id", "")).strip(),
                "barcode": str(p.get("barcode", "")).strip(),
                "description": str(p.get("description", "")).strip(),
                "score": float(sims[int(idx)]),
                "rank": len(candidates) + 1,
            })
        return candidates


# ---------------------------------------------------------------------------
# Main RAG orchestrator
# ---------------------------------------------------------------------------

class RecipeRAG:
    """
    End-to-end RAG with multi-turn chat support and MongoDB product grounding.

    Two-stage response design:
      1. chat() returns quickly with the LLM answer + recipe_context_id.
      2. Caller fetches product cards separately via get_context_products()
         + mongo_resolver.fetch_for_display() (or the /api/recipe/products route).

    Usage from Flask:
        rag = RecipeRAG()
        result = rag.chat("session-123", "what beef recipes do you have?")
        products = rag.mongo_resolver.fetch_for_display(
            rag.get_context_products(result["recipe_context_id"])
        )
    """

    def __init__(self,
                 index_dir: str = INDEX_DIR,
                 max_turns: int = MAX_TURNS_PER_SESSION,
                 embedding_model_name: str = EMBEDDING_MODEL_NAME):
        if SentenceTransformer is None:
            raise RuntimeError("sentence-transformers not installed")

        print(f"[RecipeRAG] loading embedding model: {embedding_model_name}")
        self.model = SentenceTransformer(embedding_model_name)

        self.retriever = RecipeRetriever(self.model, index_dir)
        self.product_matcher = ProductMatcher(self.model, index_dir)
        self.mongo_resolver = MongoProductResolver()
        self.llm = LLMClient()

        self.max_turns = max_turns
        self.sessions: Dict[str, List[Dict]] = {}
        # context_id → list of confirmed MongoDB lookup keys for that turn
        self._context_store: Dict[str, List[Dict]] = {}
        self._context_store_created: Dict[str, float] = {}
        self._CONTEXT_STORE_MAX = 500
        print(f"[RecipeRAG] ready (max {max_turns} turns/session)")

    # -- session management -------------------------------------------------

    def reset_session(self, session_id: str):
        self.sessions.pop(session_id, None)

    def turn_count(self, session_id: str) -> int:
        return len(self.sessions.get(session_id, [])) // 2

    def _purge_context_store(self):
        if not self._context_store:
            return
        now = time.time()
        expired = [
            key for key, created in self._context_store_created.items()
            if now - created > CONTEXT_STORE_TTL_SECONDS
        ]
        for key in expired:
            self._context_store.pop(key, None)
            self._context_store_created.pop(key, None)

        while len(self._context_store) > self._CONTEXT_STORE_MAX:
            oldest_key = next(iter(self._context_store))
            self._context_store.pop(oldest_key, None)
            self._context_store_created.pop(oldest_key, None)

    def get_context_products(self, context_id: str) -> Optional[List[Dict]]:
        """Return MongoDB lookup keys stored for a given recipe context id."""
        self._purge_context_store()
        return self._context_store.get(context_id)

    # -- context building ---------------------------------------------------

    def _build_context(self, results: List[Dict], mongo_names: List[str]) -> str:
        """Build recipe context with clean ingredient lists and Mongo product constraint."""
        parts = []
        for r in results:
            m = r["metadata"]
            ingredients_text = "\n".join(f"- {ing}" for ing in m.get("ingredients", []))
            instructions_text = "\n".join(
                f"{j+1}. {s}" for j, s in enumerate(m.get("instructions", []))
            )
            recipe_text = (
                f"Recipe: {m.get('name', '')}\n"
                f"Description: {m.get('description', '')}\n"
                f"Category: {m.get('category', '')} | Cuisine: {m.get('cuisine', '')}\n"
                f"Prep: {m.get('prep_time', '')} | Cook: {m.get('cook_time', '')} | "
                f"Serves: {m.get('servings', '')}\n\n"
                f"Ingredients:\n{ingredients_text}\n\n"
                f"Instructions:\n{instructions_text}"
            )
            parts.append(
                f"[Recipe: {m.get('name', '')} | Score: {r['score']:.3f}]\n{recipe_text}"
            )

        context = "\n\n---\n\n".join(parts)

        if mongo_names:
            names_str = ", ".join(mongo_names)
            context += (
                f"\n\n---\n\n"
                f"Use only the following products in the recipe: {names_str}. "
                f"Do not reference any products not in this list."
            )
        else:
            context += (
                "\n\n---\n\n"
                "No MongoDB product candidates are available for this turn yet. "
                "Do not present shopping product suggestions unless they are "
                "explicitly provided."
            )

        return context

    def _should_attach_products(self, user_query: str, answer: str) -> bool:
        """
        Product cards are only useful when the assistant has returned a detailed
        recipe or ingredient list. Do not show them for guardrail replies,
        general recipe browsing, or unrelated questions.
        """
        answer_l = answer.lower()
        if "i can only help with recipe and cooking questions" in answer_l:
            return False
        if "what would you like to cook" in answer_l:
            return False

        has_ingredient_heading = bool(re.search(
            r"(^|\n)\s*(#{1,6}\s*)?(\*\*)?"
            r"(ingredients|ingredient list|what you'll need)"
            r"(\*\*)?\s*(:|\n)",
            answer,
            flags=re.I,
        ))
        has_step_section = bool(re.search(
            r"(^|\n)\s*(#{1,6}\s*)?(\*\*)?"
            r"(instructions|method|steps|directions)"
            r"(\*\*)?\s*(:|\n)",
            answer,
            flags=re.I,
        ))

        if has_ingredient_heading and has_step_section:
            return True

        query_l = user_query.lower()
        asks_for_ingredients = bool(re.search(
            r"\b(ingredients?|shopping list|what do i need)\b",
            query_l,
        ))
        asks_for_detail = bool(re.search(
            r"\b(full|complete|show me|details?|recipe for|"
            r"how to (make|cook|prepare)|steps?|instructions?)\b",
            query_l,
        ))
        return has_ingredient_heading and (asks_for_ingredients or asks_for_detail)

    def _query_requests_detailed_recipe(self, user_query: str) -> bool:
        query_l = user_query.lower()
        return bool(re.search(
            r"\b(full|complete|show me|details?|recipe|recipe for|ingredients?|"
            r"shopping list|what do i need|how to (make|cook|prepare)|"
            r"steps?|instructions?)\b",
            query_l,
        ))

    def _select_recipe_for_answer(
        self,
        results: List[Dict],
        answer: str,
        user_query: str = "",
    ) -> Optional[Dict]:
        if not results:
            return None
        haystack_l = f"{answer} {user_query}".lower()
        recipe_names = []
        for result in results:
            name = str(result["metadata"].get("name", ""))
            short_name = re.sub(r"\s+recipe\s+\|\s+woolworths$", "", name, flags=re.I)
            short_name = re.sub(r"\s+\|\s+woolworths$", "", short_name, flags=re.I)
            recipe_names.append((result, name, short_name))

        recipe_names.sort(
            key=lambda item: max(len(item[1]), len(item[2])),
            reverse=True,
        )
        for result, name, short_name in recipe_names:
            if name and name.lower() in haystack_l:
                return result
            if short_name and short_name.lower() in haystack_l:
                return result
        return results[0]

    def _candidate_map_for_ingredients(self, ingredients: List[str]) -> Dict[str, Optional[Dict]]:
        if not ingredients:
            return {}
        return self.product_matcher.batch_find_product_candidates(ingredients)

    def _prefetch_query_product_names(self, user_query: str, limit: int = 10) -> List[str]:
        candidates = self.product_matcher.find_query_product_candidates(
            user_query,
            top_k=max(limit * 2, limit),
        )
        products = self.mongo_resolver.resolve_names(candidates)
        names = [p["product_name"] for p in products[:limit]]
        if names:
            print("[RecipeRAG] pre-fetched product names for prompt: "
                  f"{', '.join(names)}")
        else:
            print("[RecipeRAG] no pre-fetched Mongo products for prompt")
        return names

    def _resolve_recipe_products(self, recipe: Optional[Dict]) -> Dict:
        if not recipe:
            return {"products": [], "matches": []}
        ingredients = list(recipe["metadata"].get("ingredients", []))
        ingredient_candidates = self._candidate_map_for_ingredients(ingredients)
        return self.mongo_resolver.resolve_ingredient_matches(
            ingredients,
            ingredient_candidates,
        )

    def _append_mongo_matches_to_answer(self, answer: str, matches: List[Dict]) -> str:
        if not matches:
            return answer
        lines = answer.splitlines()
        annotated_lines = []
        in_ingredients = False
        match_idx = 0
        annotated_count = 0

        ingredient_heading = re.compile(
            r"^\s*(#{1,6}\s*)?(\*\*)?(ingredients|ingredient list|what you'll need)"
            r"(\*\*)?\s*:?\s*$",
            re.I,
        )
        next_section = re.compile(
            r"^\s*(#{1,6}\s*)?(\*\*)?"
            r"(instructions|method|steps|directions|notes?|serve|serving)"
            r"(\*\*)?\s*:?\s*$",
            re.I,
        )
        ingredient_bullet = re.compile(r"^(\s*(?:[-*•]|\d+[.)])\s+)(.+)$")

        for line in lines:
            stripped = line.strip()
            if ingredient_heading.match(stripped):
                in_ingredients = True
                annotated_lines.append(line)
                continue
            if in_ingredients and next_section.match(stripped):
                in_ingredients = False

            bullet_match = ingredient_bullet.match(line)
            if in_ingredients and bullet_match and match_idx < len(matches):
                product_name = matches[match_idx]["product_name"]
                line = (
                    f"{bullet_match.group(1)}{bullet_match.group(2)} "
                    f"(Mongo product: {product_name})"
                )
                match_idx += 1
                annotated_count += 1

            annotated_lines.append(line)

        if annotated_count:
            return "\n".join(annotated_lines)

        lines = ["", "**Mongo-matched ingredients:**"]
        for match in matches:
            lines.append(
                f"- {match['ingredient']} -> {match['product_name']}"
            )
        return answer.rstrip() + "\n\n" + "\n".join(lines)

    # -- core query ---------------------------------------------------------

    def chat(self, session_id: str, user_query: str, top_k: int = 3) -> Dict:
        """
        Multi-turn RAG chat. Returns the LLM answer immediately together with
        a recipe_context_id that the caller uses to fetch product cards via
        GET /api/recipe/products?context_id=... (products_pending=True signals this).
        """
        history = self.sessions.setdefault(session_id, [])

        if self.turn_count(session_id) >= self.max_turns:
            return {
                "answer": (f"You've reached the {self.max_turns}-message limit "
                           "for this conversation. Please start a new chat to "
                           "continue exploring recipes."),
                "sources": [],
                "turns": self.turn_count(session_id),
                "limit_reached": True,
                "product_candidate_names": [],
                "products_pending": False,
                "recipe_context_id": None,
            }

        # 1. Retrieve recipes
        results = self.retriever.search(user_query, top_k=top_k)

        # Product cards are still resolved after the LLM answer is known, but
        # generation gets a Mongo-grounded product constraint up front.
        mongo_products: List[Dict] = []
        mongo_names: List[str] = self._prefetch_query_product_names(user_query)
        confirmed_lookups: List[Dict] = []
        ingredient_matches: List[Dict] = []

        # 2. Prepare a context id. It is only exposed if this answer needs product cards.
        context_id = str(uuid.uuid4())

        # 3. Build context with clean recipe text + Mongo product constraint
        context = self._build_context(results, mongo_names)

        # 4. Build user message
        if not history:
            user_msg = (f"Recipes from our database:\n\n{context}\n\n"
                        f"User: {user_query}")
        else:
            user_msg = (f"[Additional recipes that may be relevant:\n{context}]"
                        f"\n\nUser: {user_query}")

        history.append({"role": "user", "content": user_msg})

        # 5. Generate via cascade
        try:
            answer = self.llm.generate(CHAT_SYSTEM_PROMPT, history)
        except RuntimeError as e:
            history.pop()
            return {
                "answer": f"Sorry, all LLM providers are busy right now. {e}",
                "sources": [],
                "turns": self.turn_count(session_id),
                "limit_reached": False,
                "error": True,
                "product_candidate_names": [],
                "products_pending": False,
                "recipe_context_id": None,
            }

        should_attach_products = self._should_attach_products(
            user_query,
            answer,
        )
        if should_attach_products:
            answered_recipe = self._select_recipe_for_answer(results, answer, user_query)
            resolved = self._resolve_recipe_products(answered_recipe)
            mongo_products = resolved["products"]
            ingredient_matches = resolved["matches"]
            mongo_names = [p["product_name"] for p in mongo_products]
            confirmed_lookups = [p["lookup"] for p in mongo_products]
            answer = self._append_mongo_matches_to_answer(answer, ingredient_matches)

        history.append({"role": "assistant", "content": answer})

        products_pending = bool(confirmed_lookups) and should_attach_products

        if products_pending:
            self._purge_context_store()
            self._context_store[context_id] = confirmed_lookups
            self._context_store_created[context_id] = time.time()
            self._purge_context_store()

        return {
            "answer": answer,
            "sources": [
                {"name": r["metadata"].get("name", ""), "score": r["score"]}
                for r in results
            ],
            "turns": self.turn_count(session_id),
            "limit_reached": self.turn_count(session_id) >= self.max_turns,
            "product_candidate_names": mongo_names if products_pending else [],
            "products_pending": products_pending,
            "recipe_context_id": context_id if products_pending else None,
        }


# ---------------------------------------------------------------------------
# CLI smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    rag = RecipeRAG()
    sid = "cli-interactive"
    print("\n" + "=" * 60)
    print("RAG INTERACTIVE CHAT — type 'quit' to exit, 'reset' for new session")
    print("=" * 60)
    while True:
        try:
            q = input("\n YOU: ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not q:
            continue
        if q.lower() in ("quit", "exit"):
            break
        if q.lower() == "reset":
            rag.reset_session(sid)
            print("  [session reset]")
            continue
        r = rag.chat(sid, q)
        print(f"\n BOT (turn {r['turns']}): {r['answer']}")
        if r.get("limit_reached"):
            print(f"  -- {rag.max_turns}-turn limit hit; type 'reset' to continue --")
