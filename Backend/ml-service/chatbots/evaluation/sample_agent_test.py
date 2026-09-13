"""Smoke test for the product-search and price-comparison chatbot agent.

Run from Backend/ml-service:
    python chatbots/evaluation/sample_agent_test.py
"""

import os
import sys


CURRENT_DIR = os.path.dirname(__file__)
ML_SERVICE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
if ML_SERVICE_DIR not in sys.path:
    sys.path.insert(0, ML_SERVICE_DIR)

from chatbots.agents import DiscountMateAgent
from chatbots.mcp_tools import price_comparison, product_search


class FakeProductRepository:
    def __init__(self):
        self.search_queries = []

    def search_products(self, **kwargs):
        product_name = kwargs.get("product_name") or "Coke Zero 2L"
        self.search_queries.append(product_name)
        return [{
            "product_id": "dynamic-product-result",
            "product_name": product_name,
            "brand": None,
            "pack_size": None,
            "category": None,
            "image_url": None,
            "score": 1.0,
        }]

    def get_product_details(self, product_id):
        return self.search_products(product_name="")[0]

    def get_prices(self, product_id, retailers=None):
        return [
            {"retailer": "Coles", "price": 3.20, "currency": "AUD"},
            {"retailer": "Woolworths", "price": 3.50, "currency": "AUD"},
        ]

    def compare_prices(self, product_id, retailers=None):
        prices = self.get_prices(product_id, retailers)
        return {
            "matched_product": self.search_products(product_name="")[0],
            "prices": prices,
            "cheapest": prices[0],
            "status": "success",
        }


def main():
    repo = FakeProductRepository()
    agent = DiscountMateAgent(
        tool_registry={
            "search_products": lambda arguments: product_search.run(arguments, repository=repo),
            "compare_prices": lambda arguments: price_comparison.run(arguments, repository=repo),
        },
        enable_llm_planning=False,
    )
    assert agent.workflow_backend in ("langgraph", "local-fallback"), agent.workflow_backend
    assert set(agent.workflow.tool_registry) == {"search_products", "compare_prices"}
    print(f"chatbot workflow backend: {agent.workflow_backend}")

    price = agent.chat({
        "session_id": "demo-session",
        "message": "Compare prices for Coke Zero 2L at Coles and Woolworths",
    })
    assert price.success is True, price
    assert price.action == "compare_prices", price
    assert price.data["cheapest"]["retailer"] == "Coles", price
    print("compare_prices routed through combined agent")

    search = agent.chat({
        "session_id": "demo-session",
        "message": "Find oat milk",
    })
    assert search.success is True, search
    assert search.action == "search_products", search
    assert repo.search_queries[-1].lower() == "oat milk", repo.search_queries
    assert "oat milk" in search.answer.lower(), search
    print("arbitrary product name routed dynamically to product repository")

    invalid = agent.chat({"session_id": "", "message": ""})
    assert invalid.success is False, invalid
    assert invalid.error.code == "invalid_request", invalid
    print("invalid input returns structured validation error")

    print("Combined chatbot agent smoke test passed.")


if __name__ == "__main__":
    main()
