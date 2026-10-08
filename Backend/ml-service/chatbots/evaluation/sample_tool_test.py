"""Sample terminal test for the DL-06 chatbot MCP-style tools.

Run from Backend/ml-service:
    python chatbots/evaluation/sample_tool_test.py

This uses fake product data, so it checks the tool contracts and workflow
without requiring MongoDB credentials.
"""

import json
import os
import sys


CURRENT_DIR = os.path.dirname(__file__)
ML_SERVICE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
if ML_SERVICE_DIR not in sys.path:
    sys.path.insert(0, ML_SERVICE_DIR)

from chatbots.mcp_tools import TOOL_REGISTRY


class FakeProductRepository:
    """Tiny in-memory repository used for local smoke testing."""

    def __init__(self):
        self.product = {
            "product_id": "demo-coke-zero-2l",
            "product_name": "Coca-Cola Coke Zero 2L",
            "brand": "Coca-Cola",
            "pack_size": "2L",
            "category": "Soft drinks",
            "image_url": None,
            "score": 1.0,
            "product_code": "10001",
            "gtin": "9300000000000",
            "description": "Demo product for chatbot MCP tool testing",
            "unit_per_prod": "2",
            "measurement": "L",
        }
        self.prices = [
            {
                "retailer": "Coles",
                "price": 3.20,
                "currency": "AUD",
                "unit_price": "$1.60 / 1L",
                "is_on_special": True,
                "price_date": "2026-08-20",
            },
            {
                "retailer": "Woolworths",
                "price": 3.50,
                "currency": "AUD",
                "unit_price": "$1.75 / 1L",
                "is_on_special": False,
                "price_date": "2026-08-20",
            },
        ]

    def search_products(self, **kwargs):
        return [self._candidate()]

    def get_product_details(self, product_id):
        if product_id != self.product["product_id"]:
            return None
        return {**self.product, "prices": self.prices}

    def get_prices(self, product_id, retailers=None):
        if product_id != self.product["product_id"]:
            return []
        if not retailers:
            return self.prices
        wanted = {str(retailer).lower() for retailer in retailers}
        return [
            price for price in self.prices
            if price["retailer"].lower() in wanted
        ]

    def compare_prices(self, product_id, retailers=None):
        product = self.get_product_details(product_id)
        if not product:
            return {
                "matched_product": None,
                "prices": [],
                "cheapest": None,
                "status": "not_found",
            }

        prices = sorted(
            self.get_prices(product_id, retailers),
            key=lambda item: item["price"],
        )
        return {
            "matched_product": self._candidate(),
            "prices": prices,
            "cheapest": prices[0] if prices else None,
            "status": "success" if prices else "no_prices",
        }

    def _candidate(self):
        return {
            key: self.product[key]
            for key in (
                "product_id",
                "product_name",
                "brand",
                "pack_size",
                "category",
                "image_url",
                "score",
            )
        }


def as_dict(response):
    if hasattr(response, "model_dump"):
        return response.model_dump()
    return response.dict()


def print_result(title, response):
    print(f"\n=== {title} ===")
    print(json.dumps(as_dict(response), indent=2))


def assert_success(response, expected_tool):
    assert response.success is True, response
    assert response.tool == expected_tool, response


def main():
    assert set(TOOL_REGISTRY) == {"search_products", "compare_prices"}
    repo = FakeProductRepository()

    search = TOOL_REGISTRY["search_products"](
        {
            "product_name": "Coke Zero",
            "brand": "Coca-Cola",
            "pack_size": "2L",
        },
        repository=repo,
    )
    assert_success(search, "search_products")
    print_result("search_products", search)

    comparison = TOOL_REGISTRY["compare_prices"](
        {
            "product_name": "Coke Zero",
            "brand": "Coca-Cola",
            "pack_size": "2L",
        },
        repository=repo,
    )
    assert_success(comparison, "compare_prices")
    assert comparison.data["cheapest"]["retailer"] == "Coles"
    print_result("compare_prices", comparison)

    print("\nAll sample chatbot tool tests passed.")


if __name__ == "__main__":
    main()
