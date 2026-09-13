"""
Python Flask API Service for Data Analytics
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime
import os

from analytics.price_comparison import compare_prices_by_keyword
from analytics.data_cleaning import clean_transaction_data

app = Flask(__name__)
CORS(app)

ANALYTICS_SERVICE_PORT = int(os.getenv("ANALYTICS_SERVICE_PORT", 5002))


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "Analytics Service",
        "timestamp": datetime.now().isoformat()
    })


# =========================
# SALES SUMMARY
# =========================
@app.route("/api/analytics/sales-summary", methods=["POST"])
def get_sales_summary():
    try:
        data = request.get_json() or {}

        keyword = data.get("keyword")
        store = data.get("store", "all")

        if not keyword:
            return jsonify({
                "success": False,
                "error": "keyword is required"
            }), 400

        return jsonify({
            "success": True,
            "summary": {
                "keyword": keyword,
                "store": store,
                "total_products": 18,
                "average_price": 5.24,
                "lowest_price": 4.99,
                "highest_price": 6.10,
                "message": "Sample sales summary data"
            }
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# =========================
# BRAND ANALYSIS
# =========================
@app.route("/api/analytics/brand-analysis", methods=["POST"])
def get_brand_analysis():
    try:
        data = request.get_json() or {}

        keyword = data.get("keyword")
        top_n = data.get("top_n", 5)

        if not keyword:
            return jsonify({
                "success": False,
                "error": "keyword is required"
            }), 400

        brands = [
            {"brand": "A2", "count": 12},
            {"brand": "Devondale", "count": 9},
            {"brand": "Pauls", "count": 7},
            {"brand": "Farmhouse", "count": 5},
            {"brand": "Coles", "count": 4}
        ]

        return jsonify({
            "success": True,
            "keyword": keyword,
            "top_brands": brands[:top_n]
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# =========================
# PRICE COMPARISON
# =========================
@app.route("/api/analytics/price-comparison", methods=["POST"])
def get_price_comparison():

    try:
        data = request.get_json() or {}

        keyword = data.get("keyword")
        include_details = data.get("include_details", False)

        if not keyword:
            return jsonify({
                "success": False,
                "error": "keyword is required"
            }), 400

        comparison = compare_prices_by_keyword(
            keyword=keyword,
            include_details=include_details
        )

        return jsonify({
            "success": True,
            "keyword": keyword,
            "comparison": comparison
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# =========================
# DATA CLEANING
# =========================
@app.route("/api/analytics/data-cleaning", methods=["POST"])
def clean_data():

    try:
        data = request.get_json() or {}

        transactions = data.get("data", [])
        operations = data.get(
            "operations",
            ["remove_duplicates", "handle_missing"]
        )

        if not transactions:
            return jsonify({
                "success": False,
                "error": "data array is required"
            }), 400

        cleaned_data = clean_transaction_data(
            transactions,
            operations
        )

        return jsonify({
            "success": True,
            "original_count": len(transactions),
            "cleaned_count": len(cleaned_data),
            "operations_applied": operations,
            "cleaned_data": cleaned_data
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


if __name__ == "__main__":

    print(f"Starting Analytics Service on port {ANALYTICS_SERVICE_PORT}")
    print("Available endpoints:")
    print("GET  /health")
    print("POST /api/analytics/sales-summary")
    print("POST /api/analytics/brand-analysis")
    print("POST /api/analytics/price-comparison")
    print("POST /api/analytics/data-cleaning")

    app.run(
        host="0.0.0.0",
        port=ANALYTICS_SERVICE_PORT,
        debug=True
    )