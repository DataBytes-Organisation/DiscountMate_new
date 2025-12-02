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

if __name__ == '__main__':
    print(f"Starting ML/AI Service on port {ML_SERVICE_PORT}")
    print("Available endpoints:")
    print("  GET  /health - Health check")
    print("  GET  /api/weekly-specials - Get this week's top specials")
    print("  POST /api/ml/recommendations - Get product recommendations")
    print("  POST /api/ml/price-prediction - Predict future prices")
    app.run(host='0.0.0.0', port=ML_SERVICE_PORT, debug=True)

