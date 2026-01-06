"""
Python Flask API Service for Data Analytics
This service provides endpoints for data processing, analysis, and reporting
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime
import os

# Import analytics modules
from analytics.price_comparison import compare_prices_by_keyword
from analytics.data_cleaning import clean_transaction_data

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
# You can change the port by setting ANALYTICS_SERVICE_PORT environment variable
# Example: ANALYTICS_SERVICE_PORT=5002 python app.py
ANALYTICS_SERVICE_PORT = int(os.getenv('ANALYTICS_SERVICE_PORT', 5002))

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'Analytics Service',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/analytics/price-comparison', methods=['POST'])
def get_price_comparison():
    """
    Compare prices across stores by keyword

    This endpoint finds and compares prices for products matching a keyword:
    - Cheapest option per store
    - Price differences
    - Store-specific product availability

    Request body:
    {
        "keyword": "eggs",
        "include_details": true  // Include full product details
    }
    """
    try:
        data = request.get_json() or {}
        keyword = data.get('keyword')
        include_details = data.get('include_details', False)

        if not keyword:
            return jsonify({
                'success': False,
                'error': 'keyword is required'
            }), 400

        # Call analytics function
        comparison = compare_prices_by_keyword(keyword=keyword, include_details=include_details)

        return jsonify({
            'success': True,
            'keyword': keyword,
            'comparison': comparison
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analytics/data-cleaning', methods=['POST'])
def clean_data():
    """
    Clean and preprocess transaction data

    This endpoint performs data cleaning operations:
    - Handle missing values
    - Standardize formats
    - Remove duplicates
    - Data type conversions

    Request body:
    {
        "data": [...],  // Array of transaction objects
        "operations": ["remove_duplicates", "handle_missing", "standardize"]
    }
    """
    try:
        data = request.get_json() or {}
        transactions = data.get('data', [])
        operations = data.get('operations', ['remove_duplicates', 'handle_missing'])

        if not transactions:
            return jsonify({
                'success': False,
                'error': 'data array is required'
            }), 400

        # Call analytics function
        cleaned_data = clean_transaction_data(transactions, operations)

        return jsonify({
            'success': True,
            'original_count': len(transactions),
            'cleaned_count': len(cleaned_data) if isinstance(cleaned_data, list) else 0,
            'operations_applied': operations,
            'cleaned_data': cleaned_data
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print(f"Starting Analytics Service on port {ANALYTICS_SERVICE_PORT}")
    print("Available endpoints:")
    print("  GET  /health - Health check")
    print("  POST /api/analytics/price-comparison - Compare prices across stores")
    print("  POST /api/analytics/data-cleaning - Clean transaction data")
    app.run(host='0.0.0.0', port=ANALYTICS_SERVICE_PORT, debug=True)
