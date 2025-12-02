# ML/AI Integration Guide for DiscountMate

This guide explains how to connect your Python notebooks to the DiscountMate application.

## Architecture Overview

```
Frontend (React Native)
    ↓
Node.js Backend (Express) - Port 3000
    ↓
Python ML Service (Flask) - Port 5001
    ↓
Your ML Models & Notebooks
```

## Quick Start

### 1. Start the Python ML Service

```bash
cd Backend/ml-service
./start.sh
```

The service will start on `http://localhost:5001`

### 2. Start the Node.js Backend

```bash
cd Backend
npm install  # This will install axios if not already installed
node server.js
```

The backend will start on `http://localhost:3000`

### 3. Test the Integration

Visit: `http://localhost:3000/api/ml/weekly-specials`

You should see a JSON response with weekly specials data.

## Integrating Your ML Models

### Step 1: Export Your Model

From your Jupyter notebook, save your trained model:

```python
# Example: Save a scikit-learn model
import joblib
joblib.dump(trained_model, 'models/weekly_specials_model.pkl')

# Example: Save a TensorFlow/Keras model
model.save('models/weekly_specials_model.h5')

# Example: Save a PyTorch model
torch.save(model.state_dict(), 'models/weekly_specials_model.pth')
```

### Step 2: Create a Model Module

Create a new file `ml_models/weekly_specials.py`:

```python
import pandas as pd
import joblib
from pymongo import MongoClient

# Load your model
model = joblib.load('models/weekly_specials_model.pkl')

# Connect to MongoDB (if needed)
client = MongoClient('your_connection_string')
db = client['your_database']
products_collection = db['product']

def get_top_specials(limit=4, category=None):
    """
    Get top weekly specials using your ML model

    Args:
        limit: Number of specials to return
        category: Optional category filter

    Returns:
        List of special products with predictions
    """
    # 1. Fetch product data
    query = {}
    if category:
        query['category'] = category

    products = pd.DataFrame(list(products_collection.find(query)))

    # 2. Prepare features for your model
    # (Adjust based on your model's requirements)
    features = prepare_features(products)

    # 3. Run predictions
    predictions = model.predict(features)

    # 4. Rank products by prediction score
    products['prediction_score'] = predictions
    top_products = products.nlargest(limit, 'prediction_score')

    # 5. Format results
    specials = []
    for _, product in top_products.iterrows():
        specials.append({
            'id': product['_id'],
            'product_name': product['product_name'],
            'description': product.get('description', ''),
            'price': product['current_price'],
            'original_price': product.get('original_price', product['current_price'] * 1.5),
            'discount_percentage': calculate_discount_percentage(
                product['current_price'],
                product.get('original_price', product['current_price'] * 1.5)
            ),
            'savings': product.get('original_price', product['current_price'] * 1.5) - product['current_price'],
            'store': product.get('store', 'Unknown'),
            'store_key': product.get('store_key', 'unknown'),
            'category': product.get('category', ''),
            'icon': get_icon_for_category(product.get('category', '')),
            'image_url': product.get('link_image'),
            'product_id': str(product.get('_id', ''))
        })

    return specials

def prepare_features(products_df):
    """Prepare features for your model"""
    # Add your feature engineering logic here
    # This should match what you used during training
    return products_df[['feature1', 'feature2', ...]]

def calculate_discount_percentage(current_price, original_price):
    """Calculate discount percentage"""
    if original_price == 0:
        return 0
    return ((original_price - current_price) / original_price) * 100

def get_icon_for_category(category):
    """Map category to icon name"""
    icon_map = {
        'Pantry': 'bottle-droplet',
        'Snacks': 'circle-question',
        'Household': 'spray-can-sparkles',
        'Frozen': 'ice-cream',
        # Add more mappings
    }
    return icon_map.get(category, 'circle-question')
```

### Step 3: Update app.py

Replace the placeholder function in `app.py`:

```python
from ml_models.weekly_specials import get_top_specials

@app.route('/api/weekly-specials', methods=['GET'])
def get_weekly_specials():
    try:
        limit = int(request.args.get('limit', 4))
        category = request.args.get('category', None)

        # Use your ML model
        weekly_specials = get_top_specials(limit=limit, category=category)

        return jsonify({
            'success': True,
            'data': weekly_specials,
            'count': len(weekly_specials),
            'week': get_current_week()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
```

## Example: Using Recommendation Models

If you want to use recommendation models (e.g., from `ML/Recommendation_system/`):

```python
# ml_models/recommendations.py
from transformers import AutoTokenizer, AutoModel
import torch

# Load your BERT-based recommendation model
tokenizer = AutoTokenizer.from_pretrained('your-model-path')
model = AutoModel.from_pretrained('your-model-path')

def get_recommendations(user_id, product_id, limit=10):
    # Your recommendation logic here
    # Use the model to generate recommendations
    pass
```

Then in `app.py`:

```python
from ml_models.recommendations import get_recommendations

@app.route('/api/ml/recommendations', methods=['POST'])
def get_recommendations_endpoint():
    data = request.get_json()
    recommendations = get_recommendations(
        user_id=data.get('user_id'),
        product_id=data.get('product_id'),
        limit=data.get('limit', 10)
    )
    return jsonify({'success': True, 'data': recommendations})
```

## Example: Using Price Prediction Models

For price prediction (e.g., LSTM, ARIMA, Prophet):

```python
# ml_models/price_prediction.py
import joblib
import pandas as pd

# Load your price prediction model
model = joblib.load('models/price_prediction_model.pkl')

def predict_price(product_id, days_ahead=7):
    # Fetch historical price data
    historical_data = get_historical_prices(product_id)

    # Prepare features
    features = prepare_time_series_features(historical_data, days_ahead)

    # Predict
    prediction = model.predict(features)

    return {
        'product_id': product_id,
        'current_price': historical_data['price'].iloc[-1],
        'predicted_price': prediction[0],
        'days_ahead': days_ahead,
        'trend': 'increasing' if prediction[0] > historical_data['price'].iloc[-1] else 'decreasing'
    }
```

## Connecting to MongoDB

If your notebooks use MongoDB, update the connection in your model modules:

```python
from pymongo import MongoClient
import os

# Use environment variables for security
MONGO_URI = os.getenv('MONGO_URI', 'your_connection_string')
MONGO_DB = os.getenv('MONGO_DB', 'your_database')

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
```

## Environment Variables

Create a `.env` file in `Backend/ml-service/`:

```env
ML_SERVICE_PORT=5001
MONGO_URI=your_mongodb_connection_string
MONGO_DB=your_database_name
```

## Testing

Test your ML service directly:

```bash
# Test weekly specials
curl http://localhost:5001/api/weekly-specials?limit=4

# Test recommendations
curl -X POST http://localhost:5001/api/ml/recommendations \
  -H "Content-Type: application/json" \
  -d '{"user_id": "123", "product_id": "456", "limit": 10}'
```

## Troubleshooting

### ML Service Not Starting
- Check if port 5001 is available: `lsof -i :5001`
- Verify Python dependencies: `pip list`
- Check for import errors in `app.py`

### Connection Refused
- Ensure the Python service is running on port 5001
- Check the `ML_SERVICE_URL` in Node.js backend (default: `http://localhost:5001`)
- Verify firewall settings

### Model Loading Errors
- Ensure model files are in the correct path
- Check model file format matches the loading method
- Verify all dependencies are installed

## Next Steps

1. **Integrate your specific ML models** into the service
2. **Add caching** for frequently accessed predictions
3. **Add authentication** if needed
4. **Set up monitoring** and logging
5. **Deploy** to production (consider using Docker)

## Additional Resources

- Flask Documentation: https://flask.palletsprojects.com/
- MongoDB Python Driver: https://pymongo.readthedocs.io/
- Model Serialization: https://scikit-learn.org/stable/modules/model_persistence.html

