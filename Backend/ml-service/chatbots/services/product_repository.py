"""Mongo-backed product access for chatbot tools.

The LLM agent should not query MongoDB directly. This repository gives the
tool layer a small action-level API over the current DiscountMate data source.
"""

import re
from datetime import date, datetime
from typing import Dict, Iterable, List, Optional

from chatbots.config import CURRENCY, MONGO_DB_NAME, MONGO_URI


STORE_CHAINS = {
    "coles": ("Coles", ["coles_generic"]),
    "woolworths": ("Woolworths", ["woolworths_generic"]),
    "iga": ("IGA", ["iga_generic"]),
}


class ProductRepositoryError(RuntimeError):
    """Raised when the product repository cannot access required data."""


def _escape_regex(value: str) -> str:
    return re.escape(str(value).strip())


def _positive_float(value) -> Optional[float]:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def _date_sort_value(value) -> float:
    if isinstance(value, datetime):
        return value.timestamp()
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day).timestamp()
    if value is None:
        return 0
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0


def _json_value(value):
    if value.__class__.__name__ == "ObjectId":
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


class MongoProductRepository:
    """Reads products and latest retailer prices from current MongoDB data."""

    def __init__(self, mongo_uri: str = MONGO_URI, db_name: str = MONGO_DB_NAME):
        if not mongo_uri:
            raise ProductRepositoryError("MONGO_URI is not configured")

        try:
            from bson import ObjectId
            from pymongo import MongoClient
        except ImportError as exc:
            raise ProductRepositoryError(
                "pymongo is not installed in this Python environment"
            ) from exc

        self.ObjectId = ObjectId
        self.client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        self.client.admin.command("ping")
        self.db = self.client[db_name]
        self.products_col = self.db["products"]
        self.pricings_col = self.db["product_pricings"]
        self.categories_col = self.db["categories"]

    def search_products(
        self,
        product_name: str,
        brand: Optional[str] = None,
        pack_size: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 10,
    ) -> List[Dict]:
        product_name = product_name.strip()
        if not product_name:
            return []

        query_regex = re.compile(_escape_regex(product_name), re.I)
        match: Dict = {
            "product_code": {"$exists": True, "$ne": None},
            "$or": [
                {"product_name": query_regex},
                {"name": query_regex},
                {"item_name": query_regex},
                {"brand": query_regex},
            ],
        }

        if brand:
            match["brand"] = re.compile(_escape_regex(brand), re.I)

        if category:
            category_doc = self.categories_col.find_one(
                {"category_name": re.compile(f"^{_escape_regex(category)}$", re.I)},
                {"_id": 1},
            )
            if category_doc:
                match["category_id"] = category_doc["_id"]

        projection = {
            "product_name": 1,
            "name": 1,
            "item_name": 1,
            "product_code": 1,
            "product_id": 1,
            "brand": 1,
            "gtin": 1,
            "unit_per_prod": 1,
            "measurement": 1,
            "category_id": 1,
            "category_name": 1,
            "description": 1,
            "link_image": 1,
            "image": 1,
        }
        docs = list(self.products_col.find(match, projection).limit(limit * 4))
        ranked = [self._normalise_product(doc) for doc in docs]

        if pack_size:
            ranked = self._rank_pack_size(ranked, pack_size)
        else:
            ranked = self._score_products(ranked, product_name, brand)

        return ranked[:limit]

    def get_product_details(self, product_id: str) -> Optional[Dict]:
        doc = self._find_product(product_id)
        if not doc:
            return None
        product = self._normalise_product(doc)
        product["prices"] = self.get_prices(product["product_id"])
        return product

    def get_prices(
        self,
        product_id: str,
        retailers: Optional[Iterable[str]] = None,
    ) -> List[Dict]:
        product = self._find_product(product_id)
        if not product:
            return []

        selected = self._selected_retailers(retailers)
        prices = []
        for retailer_key, (retailer_name, chains) in selected.items():
            pricing = self._latest_pricing(product, chains)
            price = _positive_float(pricing.get("price") if pricing else None)
            if price is None:
                continue
            prices.append({
                "retailer": retailer_name,
                "price": price,
                "currency": CURRENCY,
                "unit_price": _json_value(pricing.get("unit_price")),
                "is_on_special": pricing.get("is_on_special"),
                "price_date": _json_value(pricing.get("date")),
                "store_chain": retailer_key,
            })

        prices.sort(key=lambda item: item["price"])
        return prices

    def compare_prices(
        self,
        product_id: str,
        retailers: Optional[Iterable[str]] = None,
    ) -> Dict:
        product = self.get_product_details(product_id)
        if not product:
            return {
                "matched_product": None,
                "prices": [],
                "cheapest": None,
                "status": "not_found",
            }

        prices = self.get_prices(product_id, retailers)
        return {
            "matched_product": self._candidate_from_product(product),
            "prices": prices,
            "cheapest": prices[0] if prices else None,
            "status": "success" if prices else "no_prices",
        }

    def _find_product(self, identifier: str) -> Optional[Dict]:
        identifier = str(identifier).strip()
        if not identifier:
            return None

        if self.ObjectId.is_valid(identifier) and re.fullmatch(r"[0-9a-fA-F]{24}", identifier):
            doc = self.products_col.find_one({"_id": self.ObjectId(identifier)})
            if doc:
                return doc

        doc = self.products_col.find_one({"product_id": identifier})
        if doc:
            return doc

        doc = self.products_col.find_one({"product_code": identifier})
        if doc:
            return doc

        try:
            return self.products_col.find_one({"product_code": int(identifier)})
        except ValueError:
            return None

    def _latest_pricing(self, product: Dict, store_chains: List[str]) -> Optional[Dict]:
        product_code = product.get("product_code")
        if product_code is None:
            return None

        code_variants = [product_code, str(product_code)]
        try:
            code_variants.append(int(product_code))
        except (TypeError, ValueError):
            pass

        docs = list(self.pricings_col.find({
            "product_code": {"$in": list(dict.fromkeys(code_variants))},
            "store_chain": {"$in": store_chains},
        }).limit(250))

        product_mongo_id = product.get("_id")
        scoped = []
        for doc in docs:
            linked_id = doc.get("product_id")
            if linked_id is not None and str(linked_id) != str(product_mongo_id):
                continue
            if _positive_float(doc.get("price")) is None:
                continue
            scoped.append(doc)

        if not scoped:
            return None

        scoped.sort(
            key=lambda doc: (
                _date_sort_value(doc.get("date")),
                _date_sort_value(doc.get("created_at")),
            ),
            reverse=True,
        )
        return scoped[0]

    def _normalise_product(self, doc: Dict) -> Dict:
        category_name = doc.get("category_name")
        if not category_name and doc.get("category_id"):
            category = self.categories_col.find_one(
                {"_id": doc.get("category_id")},
                {"category_name": 1},
            )
            category_name = category.get("category_name") if category else None

        unit_per_prod = doc.get("unit_per_prod")
        measurement = doc.get("measurement")
        pack_size = self._pack_size(unit_per_prod, measurement)

        return {
            "product_id": str(doc.get("_id")),
            "legacy_product_id": _json_value(doc.get("product_id")),
            "product_code": _json_value(doc.get("product_code")),
            "product_name": (
                doc.get("product_name")
                or doc.get("name")
                or doc.get("item_name")
                or "Unnamed Product"
            ),
            "brand": doc.get("brand"),
            "pack_size": pack_size,
            "category": category_name,
            "gtin": _json_value(doc.get("gtin")),
            "description": doc.get("description"),
            "unit_per_prod": _json_value(unit_per_prod),
            "measurement": _json_value(measurement),
            "image_url": doc.get("link_image") or doc.get("image"),
            "score": None,
        }

    def _pack_size(self, unit_per_prod, measurement) -> Optional[str]:
        if unit_per_prod in (None, "") and measurement in (None, ""):
            return None
        if unit_per_prod in (None, ""):
            return str(measurement)
        if measurement in (None, ""):
            return str(unit_per_prod)
        return f"{unit_per_prod}{measurement}"

    def _score_products(
        self,
        products: List[Dict],
        product_name: str,
        brand: Optional[str],
    ) -> List[Dict]:
        query = product_name.lower()
        brand_l = brand.lower() if brand else None

        def score(product: Dict) -> float:
            name = str(product.get("product_name") or "").lower()
            product_brand = str(product.get("brand") or "").lower()
            value = 0.0
            if name == query:
                value += 1.0
            if name.startswith(query):
                value += 0.7
            if query in name:
                value += 0.5
            if brand_l and brand_l == product_brand:
                value += 0.3
            return value

        for product in products:
            product["score"] = score(product)

        return sorted(
            products,
            key=lambda product: (
                product.get("score") or 0,
                product.get("product_name") or "",
            ),
            reverse=True,
        )

    def _rank_pack_size(self, products: List[Dict], pack_size: str) -> List[Dict]:
        target = re.sub(r"\s+", "", pack_size.lower())
        for product in products:
            actual = re.sub(r"\s+", "", str(product.get("pack_size") or "").lower())
            product["score"] = 1.0 if actual == target else 0.5 if target in actual else 0.0
        return sorted(products, key=lambda product: product.get("score") or 0, reverse=True)

    def _candidate_from_product(self, product: Dict) -> Dict:
        return {
            "product_id": product["product_id"],
            "product_name": product["product_name"],
            "brand": product.get("brand"),
            "pack_size": product.get("pack_size"),
            "category": product.get("category"),
            "image_url": product.get("image_url"),
            "score": product.get("score"),
        }

    def _selected_retailers(self, retailers: Optional[Iterable[str]]) -> Dict:
        if not retailers:
            return STORE_CHAINS

        selected = {}
        requested = {str(retailer).strip().lower() for retailer in retailers}
        for key, value in STORE_CHAINS.items():
            display_name = value[0].lower()
            if key in requested or display_name in requested:
                selected[key] = value
        return selected or STORE_CHAINS
