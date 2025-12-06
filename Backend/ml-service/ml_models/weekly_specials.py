"""
Weekly Specials ML Model
This module contains the ML logic for generating weekly specials.
Currently returns placeholder data, but ready for ML model integration.
"""

import pandas as pd
from typing import List, Dict, Optional


def get_weekly_specials_ml(limit: int = 4, category: Optional[str] = None) -> List[Dict]:
    """
    Get weekly specials using ML/AI models.

    This function demonstrates the pattern for integrating ML models:
    1. Load/fetch product data (from MongoDB, CSV, etc.)
    2. Prepare features for your ML model
    3. Run model predictions
    4. Rank and filter results
    5. Format and return data

    Args:
        limit: Number of specials to return
        category: Optional category filter

    Returns:
        List of special products with predictions
    """

    # TODO: Replace this with actual ML model logic
    # Example workflow:
    # 1. Load your trained model
    #    model = joblib.load('models/weekly_specials_model.pkl')
    #
    # 2. Fetch product data from MongoDB
    #    from pymongo import MongoClient
    #    client = MongoClient('your_connection_string')
    #    products = pd.DataFrame(list(client['db']['products'].find()))
    #
    # 3. Prepare features (same as training)
    #    features = prepare_features(products)
    #
    # 4. Run predictions
    #    predictions = model.predict(features)
    #    products['prediction_score'] = predictions
    #
    # 5. Rank by prediction score
    #    top_products = products.nlargest(limit, 'prediction_score')
    #
    # 6. Format results
    #    return format_specials(top_products)

    # For demo purposes, return placeholder data
    # This shows the expected data structure
    specials = [
        {
            'id': 1,
            'product_name': 'Premium Olive Oil 1L',
            'description': 'Extra virgin cold pressed',
            'price': 9.99,
            'original_price': 19.99,
            'discount_percentage': 50,
            'savings': 10.00,
            'store': 'Coles',
            'store_key': 'coles',
            'category': 'Pantry',
            'icon': 'bottle-droplet',
            'image_url': None,
            'product_id': 'prod_001'
        },
        {
            'id': 2,
            'product_name': 'Chocolate Block 200g',
            'description': 'Premium dark chocolate',
            'price': 3.60,
            'original_price': 6.00,
            'discount_percentage': 40,
            'savings': 2.40,
            'store': 'Woolworths',
            'store_key': 'woolworths',
            'category': 'Snacks',
            'icon': 'circle-question',
            'image_url': None,
            'product_id': 'prod_002'
        },
        {
            'id': 3,
            'product_name': 'Laundry Detergent 2L',
            'description': 'Advanced stain removal',
            'price': 9.75,
            'original_price': 15.00,
            'discount_percentage': 35,
            'savings': 5.25,
            'store': 'Aldi',
            'store_key': 'aldi',
            'category': 'Household',
            'icon': 'spray-can-sparkles',
            'image_url': None,
            'product_id': 'prod_003'
        },
        {
            'id': 4,
            'product_name': 'Ice Cream Tub 2L',
            'description': 'Premium vanilla bean',
            'price': 5.50,
            'original_price': 10.00,
            'discount_percentage': 45,
            'savings': 4.50,
            'store': 'Coles',
            'store_key': 'coles',
            'category': 'Frozen',
            'icon': 'ice-cream',
            'image_url': None,
            'product_id': 'prod_004'
        },
        {
            'id': 5,
            'product_name': 'Fresh Salmon Fillet 500g',
            'description': 'Tasmanian Atlantic salmon',
            'price': 12.99,
            'original_price': 19.99,
            'discount_percentage': 35,
            'savings': 7.00,
            'store': 'Woolworths',
            'store_key': 'woolworths',
            'category': 'Seafood',
            'icon': 'fish',
            'image_url': None,
            'product_id': 'prod_005'
        },
        {
            'id': 6,
            'product_name': 'Organic Avocados 4 Pack',
            'description': 'Hass avocados, ripe and ready',
            'price': 4.50,
            'original_price': 7.50,
            'discount_percentage': 40,
            'savings': 3.00,
            'store': 'Coles',
            'store_key': 'coles',
            'category': 'Fruit & Vegetables',
            'icon': 'apple-whole',
            'image_url': None,
            'product_id': 'prod_006'
        }
    ]

    # Filter by category if provided
    if category:
        specials = [s for s in specials if s['category'].lower() == category.lower()]

    # Limit results
    return specials[:limit]


def prepare_features(products_df: pd.DataFrame) -> pd.DataFrame:
    """
    Prepare features for ML model prediction.
    This should match the feature engineering done during model training.

    Args:
        products_df: DataFrame with product data

    Returns:
        DataFrame with prepared features
    """
    # TODO: Implement your feature engineering logic here
    # Example:
    # features = products_df[['price', 'discount', 'rating', 'popularity']]
    # return features
    return products_df


def format_specials(products_df: pd.DataFrame) -> List[Dict]:
    """
    Format product data into the expected specials structure.

    Args:
        products_df: DataFrame with product data and predictions

    Returns:
        List of formatted special dictionaries
    """
    # TODO: Implement formatting logic
    # This would convert your DataFrame rows into the expected dict format
    return []

