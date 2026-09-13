"""Real MongoDB smoke test for the DL-06 chatbot tools.

Run from Backend/ml-service:
    python chatbots/evaluation/mongo_tool_test.py --product-name "Coke Zero" --pack-size "2L"

This reads MONGO_URI and MONGO_DB_NAME from Backend/.env or the environment.
It never prints credentials.
"""

import argparse
import json
import os
import sys


CURRENT_DIR = os.path.dirname(__file__)
ML_SERVICE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
if ML_SERVICE_DIR not in sys.path:
    sys.path.insert(0, ML_SERVICE_DIR)

from chatbots.mcp_tools import TOOL_REGISTRY
from chatbots.services.product_repository import MongoProductRepository


def as_dict(response):
    if hasattr(response, "model_dump"):
        return response.model_dump()
    return response.dict()


def print_json(title, payload):
    print(f"\n=== {title} ===")
    print(json.dumps(payload, indent=2))


def fail(message):
    print(f"\nFAILED: {message}")
    raise SystemExit(1)


def main():
    parser = argparse.ArgumentParser(description="Run real MongoDB chatbot tool smoke test")
    parser.add_argument("--product-name", default="Coke Zero")
    parser.add_argument("--brand", default=None)
    parser.add_argument("--pack-size", default=None)
    parser.add_argument("--category", default=None)
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()

    print("Starting real MongoDB chatbot tool smoke test...")
    repo = MongoProductRepository()
    print("MongoDB connection OK.")

    search_args = {
        "product_name": args.product_name,
        "brand": args.brand,
        "pack_size": args.pack_size,
        "category": args.category,
        "limit": args.limit,
    }
    search = TOOL_REGISTRY["search_products"](search_args, repository=repo)
    search_payload = as_dict(search)
    print_json("search_products", search_payload)

    if not search.success:
        fail(search.error.message if search.error else "search_products failed")

    products = search.data.get("products") or []
    if not products:
        fail("MongoDB connected, but no products matched the test query")

    comparison = TOOL_REGISTRY["compare_prices"](
        {
            "product_name": args.product_name,
            "brand": args.brand,
            "pack_size": args.pack_size,
            "category": args.category,
        },
        repository=repo,
    )
    comparison_payload = as_dict(comparison)
    print_json("compare_prices", comparison_payload)
    if not comparison.success:
        fail(comparison.error.message if comparison.error else "compare_prices failed")

    status = comparison.data.get("status")
    cheapest = comparison.data.get("cheapest")
    print("\nMongoDB chatbot tool test completed.")
    print(f"Comparison status: {status}")
    if cheapest:
        print(f"Cheapest retailer: {cheapest['retailer']} at {cheapest['price']} {cheapest['currency']}")
    else:
        print("No valid current prices were returned for the selected product.")


if __name__ == "__main__":
    main()
