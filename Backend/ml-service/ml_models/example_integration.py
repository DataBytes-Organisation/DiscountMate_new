"""
Example: How to integrate code from your Jupyter notebooks

This file shows how to extract and use code from your notebooks in the Flask service.
"""

# ============================================================================
# STEP 1: Import necessary libraries (same as in your notebook)
# ============================================================================
import pandas as pd
import numpy as np
# import joblib  # For loading saved models
# from sklearn.feature_extraction.text import TfidfVectorizer
# from sklearn.metrics.pairwise import cosine_similarity
# from pymongo import MongoClient

# ============================================================================
# STEP 2: Load your trained model (if you have one)
# ============================================================================
# Example for scikit-learn:
# model = joblib.load('models/your_model.pkl')

# Example for TensorFlow/Keras:
# from tensorflow import keras
# model = keras.models.load_model('models/your_model.h5')

# Example for PyTorch:
# import torch
# model = torch.load('models/your_model.pth')
# model.eval()

# ============================================================================
# STEP 3: Connect to your data source (MongoDB, CSV, etc.)
# ============================================================================
# MongoDB Example:
# from pymongo import MongoClient
# client = MongoClient('your_connection_string')
# db = client['your_database']
# products_collection = db['product']

# CSV Example:
# products_df = pd.read_csv('path/to/your/products.csv')

# ============================================================================
# STEP 4: Extract your prediction/processing logic from notebook
# ============================================================================
def get_weekly_specials_ml(limit=4, category=None):
    """
    This function should contain the logic from your notebook.

    Example workflow:
    1. Load/fetch product data
    2. Prepare features (same as training)
    3. Run model predictions
    4. Rank/sort by predictions
    5. Format and return results
    """

    # Example: Fetch products from MongoDB
    # query = {}
    # if category:
    #     query['category'] = category
    # products = pd.DataFrame(list(products_collection.find(query)))

    # Example: Load from CSV
    # products = pd.read_csv('products.csv')
    # if category:
    #     products = products[products['category'] == category]

    # Example: Prepare features (adjust based on your model)
    # features = prepare_features(products)

    # Example: Run predictions
    # predictions = model.predict(features)
    # products['prediction_score'] = predictions

    # Example: Rank by prediction score
    # top_products = products.nlargest(limit, 'prediction_score')

    # Format results (this structure matches what the frontend expects)
    # specials = []
    # for _, product in top_products.iterrows():
    #     specials.append({
    #         'id': product.get('_id', product.get('product_id')),
    #         'product_name': product['product_name'],
    #         'description': product.get('description', ''),
    #         'price': float(product['current_price']),
    #         'original_price': float(product.get('original_price', product['current_price'] * 1.5)),
    #         'discount_percentage': calculate_discount(
    #             product['current_price'],
    #             product.get('original_price', product['current_price'] * 1.5)
    #         ),
    #         'savings': float(product.get('original_price', product['current_price'] * 1.5) - product['current_price']),
    #         'store': product.get('store', 'Unknown'),
    #         'store_key': product.get('store_key', 'unknown'),
    #         'category': product.get('category', ''),
    #         'icon': get_icon_for_category(product.get('category', '')),
    #         'image_url': product.get('link_image'),
    #         'product_id': str(product.get('_id', product.get('product_id', '')))
    #     })

    # For now, return empty list (replace with your logic)
    return []


def prepare_features(products_df):
    """
    Prepare features for your model.
    This should match the feature engineering you did in your notebook.
    """
    # Example feature engineering:
    # features = products_df[['price', 'discount', 'rating', 'popularity']]
    # return features
    pass


def calculate_discount(current_price, original_price):
    """Calculate discount percentage"""
    if original_price == 0:
        return 0
    return ((original_price - current_price) / original_price) * 100


def get_icon_for_category(category):
    """Map category to icon name for frontend"""
    icon_map = {
        'Pantry': 'bottle-droplet',
        'Snacks': 'circle-question',
        'Household': 'spray-can-sparkles',
        'Frozen': 'ice-cream',
        'Dairy': 'cheese',
        'Beverages': 'glass-water',
        'Bakery': 'bread-slice',
        # Add more mappings as needed
    }
    return icon_map.get(category, 'circle-question')


# ============================================================================
# EXAMPLE: Integrating Recommendation Model
# ============================================================================
def get_recommendations_ml(user_id, product_id=None, limit=10):
    """
    Example function for recommendation models.
    Extract this logic from your recommendation notebooks.
    """
    # Example: Load recommendation model
    # model = joblib.load('models/recommendation_model.pkl')

    # Example: Get user history
    # user_history = get_user_purchase_history(user_id)

    # Example: Generate recommendations
    # recommendations = model.recommend(user_id, limit)

    # Format and return
    return []


# ============================================================================
# EXAMPLE: Integrating Price Prediction Model
# ============================================================================
def predict_price_ml(product_id, days_ahead=7):
    """
    Example function for price prediction models.
    Extract this logic from your price prediction notebooks.
    """
    # Example: Load price prediction model (LSTM, ARIMA, Prophet, etc.)
    # model = joblib.load('models/price_prediction_model.pkl')

    # Example: Get historical price data
    # historical_data = get_historical_prices(product_id)

    # Example: Prepare time series features
    # features = prepare_time_series_features(historical_data, days_ahead)

    # Example: Predict
    # prediction = model.predict(features)

    return {
        'product_id': product_id,
        'current_price': 0.0,
        'predicted_price': 0.0,
        'days_ahead': days_ahead,
        'trend': 'stable'
    }


# ============================================================================
# USAGE IN app.py:
# ============================================================================
"""
Once you've created this module, update app.py:

from ml_models.example_integration import get_weekly_specials_ml

@app.route('/api/weekly-specials', methods=['GET'])
def get_weekly_specials():
    limit = int(request.args.get('limit', 4))
    category = request.args.get('category', None)

    weekly_specials = get_weekly_specials_ml(limit=limit, category=category)

    return jsonify({
        'success': True,
        'data': weekly_specials,
        'count': len(weekly_specials),
        'week': get_current_week()
    })
"""

