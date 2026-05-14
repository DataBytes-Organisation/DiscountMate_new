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
import tempfile
from werkzeug.utils import secure_filename

# Import ML model functions
from ml_models.weekly_specials import get_weekly_specials_ml
from ml_models.recommendations import get_recommendations_ml
from ocr.extractor import process_receipt_internal, build_user_response

# ============================================================
# Recipe RAG initialisation
# ============================================================
# Import the RAG class. Done here (not inside a route) so we
# can build the global `rag` instance ONCE at startup.
from recipe_rag.rag_pipeline import RecipeRAG
# The `rag` global holds the embedding model + recipe index in
# RAM for the lifetime of the Flask process. ~15-20s to construct.
# Wrapped in try/except so the rest of the service still works
# even if the index is missing or sentence-transformers is broken.
try:
    print("[startup] initialising Recipe RAG (this takes ~15s)...")
    rag = RecipeRAG()
    RAG_READY = True
except Exception as e:
    print(f"[startup] WARNING: RAG failed to initialise: {e}")
    print("[startup] /api/recipe/* endpoints will return 503.")
    rag = None
    RAG_READY = False



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


@app.route('/api/ocr/receipt', methods=['POST'])
def process_receipt_api():
    """
    Upload a receipt image and return extracted structured data
    """
    temp_path = None

    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file uploaded. Please attach a receipt image using the "file" field.'
            }), 400

        uploaded_file = request.files['file']

        if uploaded_file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No file selected. Please choose a receipt image to upload.'
            }), 400

        filename = secure_filename(uploaded_file.filename)
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}
        file_ext = os.path.splitext(filename)[1].lower()

        if file_ext not in allowed_extensions:
            return jsonify({
                'success': False,
                'error': 'Unsupported file type. Please upload a JPG, JPEG, PNG, WEBP, or BMP image.'
            }), 400

        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
            uploaded_file.save(temp_file.name)
            temp_path = temp_file.name

        internal_result = process_receipt_internal(temp_path)
        user_result = build_user_response(internal_result)

        if not user_result.get('success'):
            return jsonify(user_result), 400

        return jsonify(user_result), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Receipt processing failed: {str(e)}'
        }), 500

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

# ============================================================
# Recipe RAG endpoints
# ============================================================

@app.route('/api/recipe/stats', methods=['GET'])
def recipe_stats():
    """
    Diagnostic / health endpoint for the recipe RAG.
    Layman: "Is the recipe brain awake? How big is its memory?"
    """
    if not RAG_READY:
        return jsonify({
            'success': False,
            'ready': False,
            'error': 'RAG pipeline failed to initialise at startup'
        }), 503

    return jsonify({
        'success': True,
        'ready': True,
        'recipe_count': len(rag.retriever.recipes),
        'active_sessions': len(rag.sessions),
        'max_turns_per_session': rag.max_turns,
        'product_matcher_enabled': rag.product_matcher.enabled,
        'mongo_grounding_enabled': rag.mongo_resolver.enabled,
    })


@app.route('/api/recipe/search', methods=['GET'])
def recipe_search():
    """
    Pure retrieval — no LLM call.
    Layman: "Find me recipes whose words look like 'chicken curry' — fast and free."
    Technical: cosine similarity over the precomputed embedding index.
    Use case: autocomplete, browse-by-keyword, debugging retrieval quality.
    """
    if not RAG_READY:
        return jsonify({'success': False, 'error': 'RAG not ready'}), 503

    query = request.args.get('q', '').strip()
    top_k = int(request.args.get('top_k', 5))

    if not query:
        return jsonify({'success': False, 'error': 'Missing query parameter ?q='}), 400

    try:
        results = rag.retriever.search(query, top_k=top_k)
        # Strip the bulky `text` field; frontend doesn't need it for browse
        slim = [
            {
                'rank': r['rank'],
                'score': r['score'],
                'name': r['metadata'].get('name', ''),
                'metadata': r['metadata'],
            }
            for r in results
        ]
        return jsonify({'success': True, 'query': query, 'results': slim})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/recipe/chat', methods=['POST'])
def recipe_chat():
    """
    Full RAG chat — embed query, retrieve recipes, generate answer via LLM cascade.
    Layman: "Ask the chatbot a question, get a cooked answer back."
    Technical: orchestrates retrieve → context build → multi-turn LLM call,
               with per-session history capped at MAX_TURNS_PER_SESSION.

    Request JSON:
      {
        "session_id": "uuid-from-browser",   # required, identifies the conversation
        "message": "what can I make with chicken?",  # required, user's question
        "top_k": 5                           # optional, how many recipes to retrieve
      }

    Response JSON:
      {
        "success": true,
        "answer": "...generated text...",
        "sources": [{"name": "...", "score": 0.78}, ...],
        "turns": 1,                # how many user messages so far
        "limit_reached": false,    # true once user has sent MAX_TURNS messages
        "product_annotations": false
      }
    """
    if not RAG_READY:
        return jsonify({'success': False, 'error': 'RAG not ready'}), 503

    data = request.get_json(silent=True) or {}
    session_id = data.get('session_id')
    message = (data.get('message') or '').strip()
    top_k = int(data.get('top_k', 5))

    if not session_id:
        return jsonify({'success': False, 'error': 'session_id is required'}), 400
    if not message:
        return jsonify({'success': False, 'error': 'message is required'}), 400

    try:
        result = rag.chat(session_id=session_id, user_query=message, top_k=top_k)
        # rag.chat() already returns a clean dict; just wrap with success flag
        return jsonify({'success': True, **result})
    except Exception as e:
        # Defensive: any unexpected crash inside RAG returns 500 with a message
        # rather than dumping a stack trace to the user.
        print(f"[recipe_chat] ERROR: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/recipe/reset', methods=['POST'])
def recipe_reset():
    """
    Wipe a session's conversation history.
    Layman: "Forget everything we've talked about — start fresh."
    Technical: deletes the session_id key from rag.sessions dict, freeing
               memory and resetting the turn counter to zero.
    """
    if not RAG_READY:
        return jsonify({'success': False, 'error': 'RAG not ready'}), 503

    data = request.get_json(silent=True) or {}
    session_id = data.get('session_id')
    if not session_id:
        return jsonify({'success': False, 'error': 'session_id is required'}), 400

    rag.reset_session(session_id)
    return jsonify({'success': True, 'session_id': session_id})


@app.route('/api/recipe/products', methods=['GET'])
def recipe_products():
    """
    Fetch MongoDB-grounded product cards for a completed chat turn.
    Layman: "Give me the actual product images and prices for the
             recipe ingredients the chatbot just mentioned."
    Technical: looks up the context_id written by /api/recipe/chat,
               bulk-fetches from MongoDB products + product_pricings,
               returns display-ready cards. Call this after /chat returns
               products_pending=true to avoid blocking the first answer.

    Query params:
      context_id  (required) — value returned by /api/recipe/chat

    Response JSON:
      {
        "success": true,
        "products_used": [
          {
            "product_id":   "<MongoDB _id string>",
            "product_name": "...",
            "price":        4.50,
            "image_url":    "https://...",
            "product_url":  "/product/<MongoDB _id string>"
          }
        ]
      }
    """
    if not RAG_READY:
        return jsonify({'success': False, 'error': 'RAG not ready'}), 503

    context_id = request.args.get('context_id', '').strip()
    if not context_id:
        return jsonify({'success': False, 'error': 'context_id is required'}), 400

    product_lookups = rag.get_context_products(context_id)
    if product_lookups is None:
        return jsonify({'success': False, 'error': 'Context not found or expired'}), 404

    try:
        products_used = rag.mongo_resolver.fetch_for_display(product_lookups)
        return jsonify({'success': True, 'products_used': products_used})
    except Exception as e:
        print(f"[recipe_products] ERROR: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    print(f"Starting ML/AI Service on port {ML_SERVICE_PORT}")
    print("Available endpoints:")
    print("  GET  /health - Health check")
    print("  GET  /api/weekly-specials - Get this week's top specials")
    print("  POST /api/ml/recommendations - Get product recommendations")
    print("  POST /api/ocr/receipt - Process uploaded receipt image")
    # print("  POST /api/ml/price-prediction - Predict future prices")
    print("  GET  /api/recipe/stats - Recipe RAG diagnostics")
    print("  GET  /api/recipe/search?q=... - Recipe retrieval (no LLM)")
    print("  POST /api/recipe/chat - Recipe RAG chat (full LLM)")
    print("  POST /api/recipe/reset - Wipe a chat session")
    print("  GET  /api/recipe/products?context_id=... - Fetch product cards for a chat turn")
    app.run(host='0.0.0.0', port=ML_SERVICE_PORT, debug=True)
