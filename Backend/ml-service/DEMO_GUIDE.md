# Demo Guide: ML Integration Pattern

This guide shows how `app.py` and `ml_models/` work together.

## Architecture Overview

```
┌─────────────────────────────────────┐
│  app.py (Flask API Server)          │
│  - Handles HTTP requests            │
│  - Imports ML functions             │
│  - Returns JSON responses           │
└──────────────┬──────────────────────┘
               │ imports
               ▼
┌─────────────────────────────────────┐
│  ml_models/weekly_specials.py       │
│  - Contains ML logic                │
│  - Returns data (placeholder now)  │
│  - Ready for real ML models        │
└─────────────────────────────────────┘
```

## Key Files

### 1. `app.py` (HTTP Layer)
- **Line 14**: Imports the ML function
  ```python
  from ml_models.weekly_specials import get_weekly_specials_ml
  ```

- **Line 53**: Calls the ML function
  ```python
  weekly_specials = get_weekly_specials_ml(limit=limit, category=category)
  ```

### 2. `ml_models/weekly_specials.py` (ML Logic Layer)
- **Line 7**: Function definition
  ```python
  def get_weekly_specials_ml(limit: int = 4, category: Optional[str] = None):
  ```

- Contains placeholder data (ready for real ML models)

## How to Demo

### Step 1: Start the Service

```bash
cd Backend/ml-service
source venv/bin/activate
python app.py
```

### Step 2: Test the Endpoint

```bash
# Get weekly specials
curl 'http://localhost:5001/api/weekly-specials?limit=4'

# Filter by category
curl 'http://localhost:5001/api/weekly-specials?limit=2&category=Pantry'
```

### Step 3: Show the Code Flow

1. **HTTP Request** → `app.py` receives it at `/api/weekly-specials`
2. **Parse Parameters** → `app.py` extracts `limit` and `category`
3. **Call ML Function** → `app.py` calls `get_weekly_specials_ml()`
4. **ML Processing** → `ml_models/weekly_specials.py` processes (placeholder now)
5. **Return Data** → Function returns list of specials
6. **JSON Response** → `app.py` formats and returns JSON

## What to Highlight

### ✅ Separation of Concerns
- **app.py**: HTTP/API logic (web server stuff)
- **ml_models/**: ML/business logic (data processing)

### ✅ Easy to Extend
- Add new ML models in `ml_models/` folder
- Import and use in `app.py`
- No need to modify HTTP handling code

### ✅ Ready for Real ML
- Structure is in place
- Just replace placeholder with actual model code
- Same pattern works for all ML features

## Example: Adding a Real ML Model

When you're ready to add a real model:

1. **Save your trained model**:
   ```python
   import joblib
   joblib.dump(model, 'models/weekly_specials_model.pkl')
   ```

2. **Update `ml_models/weekly_specials.py`**:
   ```python
   def get_weekly_specials_ml(limit=4, category=None):
       # Load model
       model = joblib.load('models/weekly_specials_model.pkl')

       # Fetch data
       products = fetch_from_mongodb()

       # Run predictions
       predictions = model.predict(products)

       # Return results
       return format_results(predictions)
   ```

3. **No changes needed in `app.py`!** ✅

## Demo Script

```bash
# Terminal 1: Start ML Service
cd Backend/ml-service
source venv/bin/activate
python app.py

# Terminal 2: Test the API
curl 'http://localhost:5001/api/weekly-specials?limit=4' | python -m json.tool

# Show the code:
# 1. Open app.py - show line 14 (import) and line 53 (call)
# 2. Open ml_models/weekly_specials.py - show the function
# 3. Explain the flow
```

## Expected Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "product_name": "Premium Olive Oil 1L",
      "price": 9.99,
      "original_price": 19.99,
      "discount_percentage": 50,
      "savings": 10.0,
      "store": "Coles",
      "category": "Pantry"
    },
    ...
  ],
  "count": 4,
  "week": "2025-W48"
}
```

