# Recommendations Endpoint Demo

This demonstrates how to integrate an existing ML model into the Flask service.

## What Was Created

1. **`ml_models/recommendations.py`** - ML model integration module
   - Shows how to load the existing model
   - Returns demo output (ready for actual model integration)
   - Contains commented code showing the full integration pattern

2. **`app.py`** - Added `/api/ml/recommendations` endpoint
   - Imports from `ml_models/recommendations.py`
   - Demonstrates the separation of concerns pattern

## The Existing Model

- **Location**: `ML/Recommendation_system/Recommendation-by-Simba/product_recommendation_model.joblib`
- **Type**: Association Rule Learning (recommendation system)
- **Function**: Takes a product_id and returns recommended products

## Testing the Endpoint

### Start the Service

```bash
cd Backend/ml-service
source venv/bin/activate
python app.py
```

### Test with curl

```bash
# Get recommendations for product_id 21137
curl -X POST http://localhost:5001/api/ml/recommendations \
  -H "Content-Type: application/json" \
  -d '{"product_id": 21137, "limit": 5}'
```

### Expected Response

```json
{
  "success": true,
  "message": "Product recommendations (demo output - model integration ready)",
  "input_product_id": 21137,
  "recommendations": [
    {
      "product_id": 27966,
      "product_name": "Organic Raspberries",
      "confidence_score": 0.92,
      "reason": "Frequently bought together"
    },
    {
      "product_id": 47209,
      "product_name": "Organic Hass Avocado",
      "confidence_score": 0.88,
      "reason": "Similar customers also bought"
    },
    ...
  ],
  "count": 5,
  "model_info": {
    "model_type": "Association Rule Learning",
    "model_location": "ML/Recommendation_system/Recommendation-by-Simba/product_recommendation_model.joblib",
    "status": "demo_mode"
  }
}
```

## Integration Pattern Demonstrated

```
HTTP Request → app.py → ml_models/recommendations.py → Returns JSON
```

1. **HTTP Layer** (`app.py`):
   - Receives POST request with `product_id`
   - Calls ML function
   - Returns JSON response

2. **ML Layer** (`ml_models/recommendations.py`):
   - Contains model loading logic (commented for demo)
   - Returns formatted recommendations
   - Ready to connect to actual model

## Next Steps (To Use Actual Model)

1. Uncomment the model loading code in `ml_models/recommendations.py`
2. Load the association rules data (CSV or MongoDB)
3. Load the products data (CSV or MongoDB)
4. Call the actual model function
5. Format and return results

The structure is already in place - just uncomment and connect the data sources!

