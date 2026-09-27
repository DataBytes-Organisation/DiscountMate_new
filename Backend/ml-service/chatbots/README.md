# Product Search and Price Comparison Chatbot

This folder contains the DiscountMate assistant used only for grocery-product
search and retailer price comparison.

## Supported actions

- `search_products` dynamically searches MongoDB product names, brands, pack
  sizes, and categories.
- `compare_prices` resolves a product and compares its latest valid retailer
  prices.
- `clarification` asks for a product name when the request is incomplete.

The workflow deliberately exposes no other chatbot tools.

## Workflow

`agents/langgraph_workflow.py` validates the request, selects one of the two
supported tools, validates its arguments, executes it, and formats a unified
response for the frontend.

## Tests

From `Backend/ml-service` run:

```bash
python chatbots/evaluation/sample_tool_test.py
python chatbots/evaluation/sample_agent_test.py
python chatbots/evaluation/mongo_tool_test.py --product-name "milk"
```

The first two commands use deterministic test repositories. The MongoDB test
uses `MONGO_URI` and `MONGO_DB_NAME` from the environment and never prints
credentials.

## API routes

Flask ML service:

- `POST /api/chatbot/chat`
- `POST /api/chatbot/tools/search-products`
- `POST /api/chatbot/tools/compare-prices`

Express proxy, mounted under `/api/ml`:

- `POST /api/ml/chatbot/chat`
- `POST /api/ml/chatbot/tools/search-products`
- `POST /api/ml/chatbot/tools/compare-prices`
