"""
Product Recommendations ML Model
This module demonstrates how to integrate the existing product recommendation model.

The actual model file is located at:
ML/Recommendation_system/Recommendation-by-Simba/product_recommendation_model.joblib
"""

import pandas as pd
import joblib
from typing import List, Dict, Optional
import os

# Path to the actual model file
MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    'ML',
    'Recommendation_system',
    'Recommendation-by-Simba',
    'product_recommendation_model.joblib'
)

# Global variables to cache model and data (loaded once)
_model = None
_rules_df = None
_products_df = None


def _load_model():
    """Load the recommendation model from joblib file"""
    global _model
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Model file not found at {MODEL_PATH}\n"
                "Please ensure the model file exists or update MODEL_PATH"
            )
        _model = joblib.load(MODEL_PATH)
    return _model


def _create_mock_rules_df():
    """
    Create mock association rules dataframe for demo purposes.
    In production, this would be loaded from CSV or MongoDB.

    The rules_df needs columns: antecedents, consequents, lift
    """
    # Create sample association rules based on the notebook structure
    # These are example rules that match the model's expected format
    rules_data = {
        'antecedents': [
            frozenset({21137}),  # Organic Strawberries
            frozenset({21137}),
            frozenset({21137}),
            frozenset({21137}),
            frozenset({21137}),
            frozenset({27966}),  # Organic Raspberries
            frozenset({47209}),  # Organic Hass Avocado
        ],
        'consequents': [
            frozenset({27966}),  # Organic Raspberries
            frozenset({47209}),  # Organic Hass Avocado
            frozenset({13176}),  # Bag of Organic Bananas
            frozenset({21903}),  # Organic Baby Spinach
            frozenset({8277}),   # Apple Honeycrisp Organic
            frozenset({47209}),
            frozenset({13176}),
        ],
        'lift': [2.15, 1.88, 1.75, 1.65, 1.55, 1.45, 1.35],
        'confidence': [0.64, 0.56, 0.52, 0.49, 0.46, 0.43, 0.40],
        'support': [0.18, 0.16, 0.15, 0.14, 0.13, 0.12, 0.11]
    }
    return pd.DataFrame(rules_data)


def _create_mock_products_df():
    """
    Create mock products dataframe for demo purposes.
    In production, this would be loaded from CSV or MongoDB.

    The products_df needs columns: product_id, product_name
    """
    products_data = {
        'product_id': [21137, 27966, 47209, 13176, 21903, 8277],
        'product_name': [
            'Organic Strawberries',
            'Organic Raspberries',
            'Organic Hass Avocado',
            'Bag of Organic Bananas',
            'Organic Baby Spinach',
            'Apple Honeycrisp Organic'
        ]
    }
    return pd.DataFrame(products_data)


def get_recommendations_ml(product_id: int, limit: int = 5) -> List[Dict]:
    """
    Get product recommendations using the existing ML model.

    This function demonstrates using an actual trained model:
    1. Loads the saved joblib model
    2. Creates mock data (rules_df, products_df) for demo
    3. Calls the actual model function
    4. Formats and returns results

    Args:
        product_id: The product ID to get recommendations for
        limit: Number of recommendations to return

    Returns:
        List of recommended products with details
    """
    try:
        # Load the actual model
        model = _load_model()

        # Create mock data for demo (in production, load from CSV/MongoDB)
        rules_df = _create_mock_rules_df()
        products_df = _create_mock_products_df()

        # IMPORTANT: The model function expects a 'products' dataframe in the global scope
        # We need to inject it into the function's globals before calling
        import sys
        import types

        # Method 1: Try to inject into function's __globals__
        if hasattr(model, '__globals__'):
            model.__globals__['products'] = products_df

        # Method 2: Also add to current module's globals as backup
        globals()['products'] = products_df

        # Method 3: Create a new function with updated globals if needed
        try:
            # Try calling the model first
            recommendations_df = model(rules_df, product_id, limit)
        except NameError as e:
            if 'products' in str(e):
                # Products not found - create new function with products in globals
                func_globals = dict(model.__globals__) if hasattr(model, '__globals__') else {}
                func_globals['products'] = products_df

                # Create new function with updated globals
                new_func = types.FunctionType(
                    model.__code__,
                    func_globals,
                    model.__name__,
                    model.__defaults__,
                    model.__closure__
                )
                recommendations_df = new_func(rules_df, product_id, limit)
            else:
                raise

        # Format results for API response
        recommendations = []
        for _, row in recommendations_df.iterrows():
            recommendations.append({
                'product_id': int(row['product_id']),
                'product_name': str(row['product_name']),
                'model_type': 'Association Rule Learning',
                'source': 'product_recommendation_model.joblib'
            })

        return recommendations

    except FileNotFoundError as e:
        # If model file doesn't exist, return demo data with error message
        print(f"Warning: {e}")
        print("Returning demo data - model file not found")
        return _get_demo_recommendations(product_id, limit)
    except Exception as e:
        # If model fails for any reason, return demo data
        print(f"Error using model: {e}")
        print("Returning demo data as fallback")
        return _get_demo_recommendations(product_id, limit)


def _get_demo_recommendations(product_id: int, limit: int) -> List[Dict]:
    """Fallback demo recommendations if model can't be loaded"""
    demo_recommendations = [
        {
            'product_id': 27966,
            'product_name': 'Organic Raspberries',
            'model_type': 'Demo (model not loaded)',
            'source': 'placeholder'
        },
        {
            'product_id': 47209,
            'product_name': 'Organic Hass Avocado',
            'model_type': 'Demo (model not loaded)',
            'source': 'placeholder'
        },
        {
            'product_id': 13176,
            'product_name': 'Bag of Organic Bananas',
            'model_type': 'Demo (model not loaded)',
            'source': 'placeholder'
        },
        {
            'product_id': 21903,
            'product_name': 'Organic Baby Spinach',
            'model_type': 'Demo (model not loaded)',
            'source': 'placeholder'
        },
        {
            'product_id': 8277,
            'product_name': 'Apple Honeycrisp Organic',
            'model_type': 'Demo (model not loaded)',
            'source': 'placeholder'
        }
    ]
    return demo_recommendations[:limit]



