import os
import time
from datetime import timedelta
from typing import Dict, List

MONGO_URI = os.getenv("MONGO_URI", "").strip()
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "DiscountMate_DB")
ONE_DAY = timedelta(days=1)
CACHE_SECONDS = 600

_pricings_col = None
_cache: Dict = {'results': [], 'expires': 0.0}


def _get_pricings_collection():
    global _pricings_col
    if _pricings_col is None:
        if not MONGO_URI:
            raise RuntimeError("MONGO_URI not set")
        from pymongo import MongoClient
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        db = client[MONGO_DB_NAME]
        _pricings_col = db["product_pricings"]
    return _pricings_col


def get_recommendations_ml(limit: int = 10) -> List[Dict]:
    if time.time() < _cache['expires']:
        return _cache['results'][:limit]

    pricings = _get_pricings_collection()

    newest = pricings.find_one({}, {'date': 1}, sort=[('date', -1)])
    if not newest:
        return []

    rows = pricings.find(
        {'date': {'$gte': newest['date'] - ONE_DAY}},
        {'product_code': 1, 'store_chain': 1, 'price': 1, 'best_price': 1, 'is_on_special': 1},
    ).sort([('date', -1), ('created_at', -1)])

    seen = set()
    results = []
    for row in rows:
        code = str(row.get('product_code') or '')
        key = (code, row.get('store_chain'))
        if not code or key in seen:
            continue
        seen.add(key)

        price = float(row.get('price') or 0)
        best_price = float(row.get('best_price') or 0)
        if not row.get('is_on_special') or price <= 0 or best_price <= 0 or best_price >= price:
            continue

        results.append({
            'product_code': code,
            'store_chain': row.get('store_chain'),
            'price': round(best_price, 2),
            'was_price': round(price, 2),
            'discount_percent': round((price - best_price) / price * 100, 1),
        })

    results.sort(key=lambda r: r['discount_percent'], reverse=True)

    _cache['results'] = results[:20]
    _cache['expires'] = time.time() + CACHE_SECONDS

    return results[:limit]
