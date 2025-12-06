"""
Python Flask API Service for ML/AI Integration
This service provides endpoints for machine learning models and AI features
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
import sys

# Import ML model functions
from ml_models.weekly_specials import get_weekly_specials_ml
from ml_models.recommendations import get_recommendations_ml

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
# You can change the port by setting ML_SERVICE_PORT environment variable
# Example: ML_SERVICE_PORT=5002 python app.py
ML_SERVICE_PORT = int(os.getenv('ML_SERVICE_PORT', 5001))

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ML/AI Service',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/weekly-specials', methods=['GET'])
def get_weekly_specials():
    """
    Get this week's top specials using ML/AI models

    This endpoint can be extended to:
    - Use recommendation models to find best deals
    - Apply price prediction models to identify trending discounts
    - Use association rules to find popular combinations
    - Filter by user preferences, categories, etc.
    """
    try:
        # Get query parameters
        limit = int(request.args.get('limit', 4))
        category = request.args.get('category', None)

        # Call ML model function from ml_models module
        # This demonstrates the separation of concerns:
        # - app.py handles HTTP requests/responses
        # - ml_models/weekly_specials.py contains the ML logic
        weekly_specials = get_weekly_specials_ml(limit=limit, category=category)

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

def get_current_week():
    """Get current week identifier"""
    today = datetime.now()
    week_start = today - timedelta(days=today.weekday())
    return week_start.strftime('%Y-W%W')

@app.route('/api/ml/recommendations', methods=['POST'])
def get_recommendations():
    """
    Get product recommendations using existing ML model

    This endpoint demonstrates how to integrate an existing trained model:
    - The model file exists at: ML/Recommendation_system/Recommendation-by-Simba/product_recommendation_model.joblib
    - Currently returns demo output showing the expected structure
    - Ready to be connected to the actual model when data sources are available

    Request body:
    {
        "product_id": 21137,
        "limit": 5
    }
    """
    try:
        data = request.get_json() or {}
        product_id = data.get('product_id')
        limit = int(data.get('limit', 5))

        if product_id is None:
            return jsonify({
                'success': False,
                'error': 'product_id is required'
            }), 400

        # Call ML model function from ml_models module
        # This demonstrates the integration pattern:
        # - app.py handles HTTP requests/responses
        # - ml_models/recommendations.py contains the ML model logic
        recommendations = get_recommendations_ml(product_id=product_id, limit=limit)

        return jsonify({
            'success': True,
            'message': 'Product recommendations using existing ML model',
            'input_product_id': product_id,
            'recommendations': recommendations,
            'count': len(recommendations),
            'model_info': {
                'model_type': 'Association Rule Learning',
                'model_location': 'ML/Recommendation_system/Recommendation-by-Simba/product_recommendation_model.joblib',
                'status': 'using_actual_model' if recommendations and recommendations[0].get('source') == 'product_recommendation_model.joblib' else 'fallback_mode'
            }
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print(f"Starting ML/AI Service on port {ML_SERVICE_PORT}")
    print("Available endpoints:")
    print("  GET  /health - Health check")
    print("  GET  /api/weekly-specials - Get this week's top specials")
    print("  POST /api/ml/recommendations - Get product recommendations")
   #  print("  POST /api/ml/price-prediction - Predict future prices")
    app.run(host='0.0.0.0', port=ML_SERVICE_PORT, debug=True)

