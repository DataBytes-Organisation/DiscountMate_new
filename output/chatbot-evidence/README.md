# DL-06 Chatbot — Live Verification Evidence

Screenshots captured from the running DiscountMate web app driving the real
stack end to end. Nothing here is mocked: each answer came from live MongoDB
data through the MCP tool layer.

## Stack under test

| Layer | Detail |
|---|---|
| Frontend | Expo web (`Frontend`), floating **MateBot** widget |
| API | Node/Express on `:3000`, `POST /api/ml/chatbot/chat` |
| ML service | Flask on `:5001`, `POST /api/chatbot/chat` |
| Orchestration | `chatbots/agents/langgraph_workflow.py` |
| Tools | `TOOL_REGISTRY` → `search_products`, `compare_prices` |
| Data | MongoDB Atlas `DiscountMate_DB` — 25,591 products, 255,555 pricings, 20 categories |

## Screenshots

### `chatbot-01-widget-open.png`
The MateBot widget mounted from `Frontend/app/(tabs)/_layout.tsx`, open on the
home page with its greeting and FAQ shortcuts.

### `chatbot-02-price-comparison-success.png`
Query: **"Compare prices for Cheese Romano Block"**

> The cheapest current price for Cheese Romano Block is $6.50 at Woolworths.
> Other prices: Coles $7.50, IGA $7.50.

The retailer breakdown card below the answer renders Woolworths $6.50
(special), Coles $7.50, IGA $7.50 — matching the `compare_prices` tool output
exactly. This is the DL-06-T2 price-comparison action working against real
retailer pricing, with the cheapest option identified.

### `chatbot-03-product-search-success.png`
Query: **"Find me Freddo"**

The `search_products` tool returns five real ranked candidates with brands:
Freddo Biscuits, Dairy Milk Freddo Party Cake Frozen Dessert, Dairy Milk Freddo
Cupcakes 6 Pack, Dairy Milk Freddo Chocolate, and Dairy Milk Freddo & Caramello
Koala Chocolate Sharepack 18 Pieces — all Cadbury.

## API-level confirmation

The same two actions verified directly through the Express proxy:

```
POST /api/ml/chatbot/chat  {"message": "Compare prices for Cheese Romano Block"}
  action : compare_prices
  answer : The cheapest current price for Cheese Romano Block is $6.50 at Woolworths.
           Other prices: Coles $7.50, IGA $7.50.
  prices : [('Woolworths', 6.5), ('Coles', 7.5), ('IGA', 7.5)]

POST /api/ml/chatbot/chat  {"message": "Find me Freddo"}
  action : search_products
  answer : I found these matching products: Freddo Biscuits, ...
```

Tool routing was also confirmed correct on a query with explicit retailers —
*"Compare prices for Coke Zero 2L at Coles and Woolworths"* planned
`compare_prices` with `retailers: ["coles", "woolworths"]`.

## Reproducing

```bash
# ML service
cd Backend/ml-service && python app.py            # :5001

# API  (K_SERVICE skips the ReverseImageSearch sidecar, which is not needed here)
cd Backend && K_SERVICE=local node server.js      # :3000

# Frontend
cd Frontend && npx expo start --web               # :8081
```

## Known limitations found during this verification

1. **Brand + product name returns no match.** `search_products` compiles the
   whole phrase into one regex and requires it as a contiguous substring of
   `product_name`/`name`/`item_name`/`brand`. Because brand lives in its own
   field, `"Cadbury Freddo"` matches nothing while `"Freddo"` returns 3 hits;
   `"Perfect Italiano Cheese Romano Block"` matches nothing while
   `"Cheese Romano Block"` matches. `ProductSearchArguments` already has a
   `brand` field and the repository already filters on it — the planner in
   `langgraph_workflow.py` just never populates it.
2. **Enter does not send** in the chat input on web; `onSubmitEditing` does not
   fire under react-native-web, so the send button must be clicked.
3. **The API server exits if the ReverseImageSearch sidecar fails to start**
   (missing `uvicorn`), which blocks local development unrelated to that
   feature. Hence `K_SERVICE` above.
