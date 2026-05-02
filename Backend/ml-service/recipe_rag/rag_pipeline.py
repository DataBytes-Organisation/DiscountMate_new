"""
Recipe RAG Pipeline — local sentence-transformers retrieval +
cascading LLM generation (OpenRouter → HuggingFace fallback).

Loaded by Flask app.py at startup. One model + one index in memory,
serves many concurrent users via per-session conversation history.

Optional product matching: if Backend/ml-service/recipe_rag/index/
contains product_index.npz + product_metadata.json, ingredients in
retrieved recipes are annotated with on-sale matches. If those files
are missing, the pipeline runs fine without annotations.
"""

import json
import os
import time
from typing import Dict, List, Optional

import numpy as np
import requests
from dotenv import load_dotenv

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None
    print("WARNING: sentence-transformers not installed. "
          "Run: pip install sentence-transformers")


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Locate .env at project root (3 levels up from this file:
#   DiscountMate_new/Backend/ml-service/recipe_rag/rag_pipeline.py
#   → DiscountMate_new/.env)
_PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
_ENV_PATH = os.path.join(_PROJECT_ROOT, ".env")
if os.path.exists(_ENV_PATH):
    load_dotenv(_ENV_PATH, override=True)
    print(f"[env] loaded {_ENV_PATH}")
else:
    # Fallback: walk up from cwd (works if .env is in Backend/ or elsewhere)
    load_dotenv(override=True)
    print(f"[env] no .env at {_ENV_PATH} — fell back to cwd search")

EMBEDDING_MODEL_NAME = "all-mpnet-base-v2"
INDEX_DIR = os.path.join(os.path.dirname(__file__), "index")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
HUGGINGFACE_URL = "https://router.huggingface.co/v1/chat/completions"

OPENROUTER_API_KEY = os.getenv("OPEN_ROUTER_API_KEY", "").strip().strip('"')
HF_TOKEN = os.getenv("HUGGING_FACE_TOKEN", "").strip().strip('"')

OPENROUTER_MODELS = [
    "nvidia/nemotron-nano-12b-v2-vl:free",      # fast, instruction-tuned changing for speed
    "nvidia/nemotron-3-super-120b-a12b:free",   # best quality, no rate limit yet
    "nvidia/nemotron-3-nano-30b-a3b:free",      # fallback
]

HF_MODELS = [
    "MiniMaxAI/MiniMax-M2.7",            # rank 1
    "openai/gpt-oss-120b",               # rank 2
    "Qwen/Qwen2.5-7B-Instruct",          # rank 3
    "meta-llama/Llama-3.1-8B-Instruct",  # rank 4
]

MAX_TURNS_PER_SESSION = 3   # hard cap to prevent abuse / runaway costs

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
- Where products are shown in [brackets] after an ingredient, present them
  as shopping suggestions so users see retailer deals.
- Be friendly and concise. Do NOT say "let me know if you'd like more" —
  the user can always ask follow-ups."""


# ---------------------------------------------------------------------------
# LLM cascade (OpenRouter -> HuggingFace)
# ---------------------------------------------------------------------------

class LLMClient:
    """Cascading LLM client: OpenRouter free models → HuggingFace fallback."""

    def __init__(self,
                 openrouter_models: Optional[List[str]] = None,
                 hf_models: Optional[List[str]] = None,
                 temperature: float = 0.7,
                 max_tokens: int = 3000): #changed to 3000 tokens for longer output
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
                                  json=payload, timeout=60)
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
                                  json=payload, timeout=60)
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
        self.recipes: List[Dict] = []
        self._load()

    def _load(self):
        emb_path = os.path.join(self.index_dir, "recipe_index.npz")
        meta_path = os.path.join(self.index_dir, "recipe_metadata.json")
        if not (os.path.exists(emb_path) and os.path.exists(meta_path)):
            raise FileNotFoundError(
                f"Recipe index missing in {self.index_dir}. "
                "Run: python build_recipe_index.py"
            )
        self.embeddings = np.load(emb_path)["embeddings"].astype(np.float32)
        with open(meta_path, "r", encoding="utf-8") as f:
            self.recipes = json.load(f)
        print(f"[RecipeRetriever] loaded {len(self.recipes)} recipes "
              f"({self.embeddings.shape})")

    def search(self, query: str, top_k: int = 8) -> List[Dict]:
        q = self.model.encode([query], convert_to_numpy=True).astype(np.float32)
        q_norm = q / (np.linalg.norm(q, axis=1, keepdims=True) + 1e-10)
        e_norm = self.embeddings / (
            np.linalg.norm(self.embeddings, axis=1, keepdims=True) + 1e-10
        )
        sims = (e_norm @ q_norm.T).flatten()
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
# Optional product matching (graceful degradation)
# ---------------------------------------------------------------------------

class ProductMatcher:
    """
    Loads product_index.npz + product_metadata.json if present.
    Two modes of operation:

      LEAN mode (current, until price table exists):
        Returns top-1 description match per ingredient.
        Output: {"top": {"description", "barcode", "product_id", "score"}}

      JOINED mode (after .attach_price_table(...) is called):
        Returns top-1 cheapest on-sale product per retailer per ingredient.
        Output: {retailer: {"name", "price", "score", "barcode", ...}}

    If product index files are missing entirely, .enabled = False and
    annotate_ingredient() returns {} — recipes work without annotations.
    """

    def __init__(self, embedding_model, index_dir: str = INDEX_DIR,
                 retailers: Optional[List[str]] = None,
                 threshold: float = 0.55):
        self.model = embedding_model
        self.index_dir = index_dir
        self.threshold = threshold
        self.retailers = retailers or ["Woolworths", "Coles", "IGA"]

        self.embeddings: Optional[np.ndarray] = None
        self.products: List[Dict] = []   # [{barcode, product_id, description}]
        self.barcodes: List[str] = []

        # Optional price table: barcode -> [{"retailer", "price", "on_sale"}, ...]
        self.price_table: Dict[str, List[Dict]] = {}

        self.enabled = False
        self._try_load()

    def _try_load(self):
        emb_path = os.path.join(self.index_dir, "product_index.npz")
        meta_path = os.path.join(self.index_dir, "product_metadata.json")
        if not (os.path.exists(emb_path) and os.path.exists(meta_path)):
            print(f"[ProductMatcher] no product index in {self.index_dir} "
                  "— annotations DISABLED. Run product_embedder.py to enable.")
            return

        data = np.load(emb_path, allow_pickle=True)
        self.embeddings = data["embeddings"].astype(np.float32)
        self.barcodes = (
            data["barcodes"].tolist() if "barcodes" in data.files else []
        )
        with open(meta_path, "r", encoding="utf-8") as f:
            self.products = json.load(f)["products"]

        self.enabled = True
        print(f"[ProductMatcher] loaded {len(self.products)} products "
              f"(LEAN mode — no price table attached)")

    # -- price table hook (called later when prices are available) ----------

    def attach_price_table(self, price_table: Dict[str, List[Dict]]):
        """
        Attach a barcode -> price/sale lookup. Once attached, annotations
        switch to JOINED mode (per-retailer cheapest on-sale).

        price_table format:
            {
              "9300601186945": [
                  {"retailer": "Coles", "price": 4.50, "on_sale": True},
                  {"retailer": "Woolworths", "price": 5.00, "on_sale": False},
              ],
              ...
            }
        """
        self.price_table = price_table or {}
        print(f"[ProductMatcher] price table attached "
              f"({len(self.price_table)} barcodes) — JOINED mode active")

    @property
    def joined_mode(self) -> bool:
        return bool(self.price_table)

    # -- core matching ------------------------------------------------------

    def annotate_ingredient(self, ingredient_text: str) -> Dict:
        """
        Returns either:
          LEAN:    {"top": {description, barcode, product_id, score}}
          JOINED:  {retailer: {name, price, score, barcode, on_sale}}
          DISABLED: {}
        """
        if not self.enabled:
            return {}

        q = self.model.encode([ingredient_text], convert_to_numpy=True
                              ).astype(np.float32)
        q_norm = q / (np.linalg.norm(q, axis=1, keepdims=True) + 1e-10)
        e_norm = self.embeddings / (
            np.linalg.norm(self.embeddings, axis=1, keepdims=True) + 1e-10
        )
        sims = (e_norm @ q_norm.T).flatten()
        order = np.argsort(sims)[::-1]

        # JOINED mode — find cheapest on-sale product per retailer
        if self.joined_mode:
            matches: Dict[str, Dict] = {}
            for idx in order:
                score = float(sims[idx])
                if score < self.threshold:
                    break
                p = self.products[idx]
                offers = self.price_table.get(str(p.get("barcode", "")), [])
                for offer in offers:
                    if not offer.get("on_sale"):
                        continue
                    retailer = offer.get("retailer")
                    entry = {
                        "name": p["description"],
                        "barcode": p.get("barcode"),
                        "product_id": p.get("product_id"),
                        "price": offer["price"],
                        "on_sale": True,
                        "score": score,
                    }
                    if (retailer not in matches
                            or offer["price"] < matches[retailer]["price"]):
                        matches[retailer] = entry
            return matches

        # LEAN mode — just return the top description match (no price/retailer)
        for idx in order:
            score = float(sims[idx])
            if score < self.threshold:
                return {}
            p = self.products[idx]
            return {
                "top": {
                    "description": p["description"],
                    "barcode": p.get("barcode"),
                    "product_id": p.get("product_id"),
                    "score": score,
                }
            }
        return {}

    def annotate_recipe_text(self, recipe_metadata: Dict) -> str:
        """Rebuild recipe text with product matches inline."""
        m = recipe_metadata
        annotated = []
        for ing in m.get("ingredients", []):
            matches = self.annotate_ingredient(ing) if self.enabled else {}
            if not matches:
                annotated.append(f"- {ing}")
                continue

            if self.joined_mode:
                bits = [
                    f"{r} - {matches[r]['name']} ${matches[r]['price']:.2f}"
                    for r in self.retailers if r in matches
                ]
                annotated.append(f"- {ing} [{' | '.join(bits)}]")
            else:
                # LEAN — single suggested match, no price
                top = matches["top"]
                annotated.append(
                    f"- {ing} [math/onsale placeholder: {top['description']} "
                    f"(barcode {top['barcode']})]"
                )

        instructions = m.get("instructions", [])
        header_suffix = (
            " (with on-sale product matches)" if self.joined_mode
            else " (with closest product matches)" if self.enabled
            else ""
        )
        return (
            f"Recipe: {m.get('name','')}\n"
            f"Description: {m.get('description','')}\n"
            f"Category: {m.get('category','')} | Cuisine: {m.get('cuisine','')}\n"
            f"Prep: {m.get('prep_time','')} | Cook: {m.get('cook_time','')} | "
            f"Serves: {m.get('servings','')}\n\n"
            f"Ingredients{header_suffix}:\n"
            + "\n".join(annotated)
            + "\n\nInstructions:\n"
            + "\n".join(f"{j+1}. {s}" for j, s in enumerate(instructions))
        )

# ---------------------------------------------------------------------------
# Main RAG orchestrator
# ---------------------------------------------------------------------------

class RecipeRAG:
    """
    End-to-end RAG with multi-turn chat support.

    Usage from Flask:
        rag = RecipeRAG()              # at app startup (slow: loads model + index)
        result = rag.chat("session-123", "what beef recipes do you have?")
        result = rag.chat("session-123", "show me the first one in full")
        rag.reset_session("session-123")
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
        self.llm = LLMClient()

        self.max_turns = max_turns
        # session_id -> list of {role, content}
        self.sessions: Dict[str, List[Dict]] = {}
        print(f"[RecipeRAG] ready (max {max_turns} turns/session)")

    # -- session management -------------------------------------------------

    def reset_session(self, session_id: str):
        self.sessions.pop(session_id, None)

    def turn_count(self, session_id: str) -> int:
        return len(self.sessions.get(session_id, [])) // 2

    # -- core query ---------------------------------------------------------

    def _build_context(self, results: List[Dict]) -> str:
        parts = []
        for r in results:
            text = (
                self.product_matcher.annotate_recipe_text(r["metadata"])
                if self.product_matcher.enabled else r["text"]
            )
            parts.append(f"[Recipe: {r['metadata'].get('name','')} "
                         f"| Score: {r['score']:.3f}]\n{text}")
        return "\n\n---\n\n".join(parts)

    def chat(self, session_id: str, user_query: str,
             top_k: int = 8) -> Dict:
        """
        Multi-turn RAG chat. Hard-capped at self.max_turns user messages
        per session to control cost.
        """
        history = self.sessions.setdefault(session_id, [])

        # Cap enforcement
        if self.turn_count(session_id) >= self.max_turns:
            return {
                "answer": (f"You've reached the {self.max_turns}-message limit "
                           "for this conversation. Please start a new chat to "
                           "continue exploring recipes."),
                "sources": [],
                "turns": self.turn_count(session_id),
                "limit_reached": True,
            }

        # 1. Retrieve recipes
        results = self.retriever.search(user_query, top_k=top_k)
        context = self._build_context(results)

        # 2. Build user message — include context on first turn, refresh on later turns
        if not history:
            user_msg = (f"Recipes from our database:\n\n{context}\n\n"
                        f"User: {user_query}")
        else:
            user_msg = (f"[Additional recipes that may be relevant:\n{context}]"
                        f"\n\nUser: {user_query}")

        history.append({"role": "user", "content": user_msg})

        # 3. Generate via cascade
        try:
            answer = self.llm.generate(CHAT_SYSTEM_PROMPT, history)
        except RuntimeError as e:
            history.pop()  # rollback so user can retry without burning a turn
            return {
                "answer": f"Sorry, all LLM providers are busy right now. {e}",
                "sources": [],
                "turns": self.turn_count(session_id),
                "limit_reached": False,
                "error": True,
            }

        history.append({"role": "assistant", "content": answer})

        return {
            "answer": answer,
            "sources": [
                {"name": r["metadata"].get("name", ""),
                 "score": r["score"]}
                for r in results
            ],
            "turns": self.turn_count(session_id),
            "limit_reached": self.turn_count(session_id) >= self.max_turns,
            "product_annotations": self.product_matcher.enabled,
        }


# ---------------------------------------------------------------------------
# CLI smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
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