"""
Python Flask API Service for ML/AI Integration
This service provides endpoints for machine learning models and AI features
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime, timedelta
import os
import tempfile
from threading import Lock
from werkzeug.utils import secure_filename
import google.auth
from google.cloud.secretmanager import SecretManagerServiceClient

# Import ML model functions
from ml_models.weekly_specials import get_weekly_specials_ml
from ml_models.recommendations import get_recommendations_ml
from ml_models.price_prediction import get_price_prediction_ml
from ocr.extractor import process_receipt_internal, build_user_response


def _resolve_project_id():
    project_id = (
        os.getenv("GOOGLE_CLOUD_PROJECT")
        or os.getenv("GCLOUD_PROJECT")
        or os.getenv("GCP_PROJECT")
    )
    if project_id:
        return project_id

    try:
        _, detected_project = google.auth.default()
    except Exception:
        detected_project = None

    return detected_project


def _load_secret(secret_name):
    project_id = _resolve_project_id()
    if not project_id:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT is not set and could not be auto-detected")

    client = SecretManagerServiceClient()
    secret_version = f"projects/{project_id}/secrets/{secret_name}/versions/latest"
    response = client.access_secret_version(request={"name": secret_version})
    payload = response.payload.data.decode("utf-8").strip() if response.payload and response.payload.data else ""

    if not payload:
        raise RuntimeError(f"Secret {secret_name} is empty or unreadable")

    return payload


def ensure_runtime_secrets():
    secret_mappings = [
        ("MONGO_URI", "MONGO_URI_SECRET_NAME", "mongo-uri"),
        ("OPEN_ROUTER_API_KEY", "OPEN_ROUTER_API_KEY_SECRET_NAME", "open-router-api-key"),
        ("HUGGING_FACE_TOKEN", "HUGGING_FACE_TOKEN_SECRET_NAME", "hugging-face-token"),
    ]

    for env_var, secret_name_env, default_secret_name in secret_mappings:
        if os.getenv(env_var, "").strip():
            continue

        secret_name = os.getenv(secret_name_env, default_secret_name).strip()
        try:
            os.environ[env_var] = _load_secret(secret_name)
            print(f"[startup] loaded {env_var} from Secret Manager secret '{secret_name}'")
        except Exception as exc:
            print(f"[startup] WARNING: could not load {env_var} from Secret Manager secret '{secret_name}': {exc}")


ensure_runtime_secrets()

# ============================================================
# Recipe RAG initialisation
# ============================================================
from recipe_rag.rag_pipeline import RecipeRAG

rag = None
RAG_INIT_ERROR = None
RAG_LOCK = Lock()


def get_rag():
    """Lazy-load RAG so basic ML endpoints can start quickly in Cloud Run."""
    global rag, RAG_INIT_ERROR

    if rag is not None:
        return rag

    with RAG_LOCK:
        if rag is not None:
            return rag
        if RAG_INIT_ERROR is not None:
            raise RuntimeError(f"RAG pipeline failed to initialise: {RAG_INIT_ERROR}")

        try:
            print("[recipe_rag] initialising Recipe RAG on first request...")
            rag = RecipeRAG()
            return rag
        except Exception as exc:
            RAG_INIT_ERROR = exc
            print(f"[recipe_rag] WARNING: RAG failed to initialise: {exc}")
            raise RuntimeError(f"RAG pipeline failed to initialise: {exc}") from exc


def rag_not_ready_response(error):
    return jsonify({
        'success': False,
        'ready': False,
        'error': str(error),
    }), 503



app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
# You can change the port by setting ML_SERVICE_PORT environment variable
# Example: ML_SERVICE_PORT=5002 python app.py
ML_SERVICE_PORT = int(os.getenv('ML_SERVICE_PORT', 5001))


def success_payload(**payload):
    return jsonify({
        'success': True,
        **payload,
    })


def error_payload(message, error, status_code=500):
    return jsonify({
        'success': False,
        'message': message,
        'error': error,
    }), status_code


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

        return success_payload(
            data=weekly_specials,
            count=len(weekly_specials),
            week=get_current_week()
        )

    except Exception as e:
        return error_payload('Failed to fetch weekly specials', str(e))


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
            return error_payload('Invalid request', 'product_id is required', 400)

        # Call ML model function from ml_models module
        # This demonstrates the integration pattern:
        # - app.py handles HTTP requests/responses
        # - ml_models/recommendations.py contains the ML model logic
        recommendations = get_recommendations_ml(product_id=product_id, limit=limit)

        return success_payload(
            message='Product recommendations using existing ML model',
            input_product_id=product_id,
            recommendations=recommendations,
            count=len(recommendations),
            model_info={
                'model_type': 'Association Rule Learning',
                'model_location': os.getenv('RECOMMENDATION_MODEL_PATH', '/app/models/product_recommendation_model.joblib'),
                'status': 'using_actual_model' if recommendations and recommendations[0].get('source') == 'product_recommendation_model.joblib' else 'fallback_mode'
            }
        )

    except Exception as e:
        return error_payload('Failed to get recommendations', str(e))


@app.route('/api/ml/price-prediction', methods=['POST'])
def get_price_prediction():
    try:
        data = request.get_json() or {}
        product_id = data.get('product_id')
        days_ahead = int(data.get('days_ahead', 7))
        current_price = data.get('current_price')
        price_history = data.get('price_history') or []

        if product_id is None:
            return error_payload('Invalid request', 'product_id is required', 400)

        numeric_history = []
        for value in price_history:
            try:
                numeric_history.append(float(value))
            except (TypeError, ValueError):
                continue

        if current_price is None:
            current_price = numeric_history[-1] if numeric_history else 0

        prediction = get_price_prediction_ml(
            product_id=str(product_id),
            days_ahead=days_ahead,
            current_price=float(current_price),
            price_history=numeric_history,
        )

        return success_payload(**prediction)
    except Exception as e:
        return error_payload('Failed to get price prediction', str(e))


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
    if rag is None:
        payload = {
            'success': True,
            'ready': False,
            'loaded': False,
        }
        if RAG_INIT_ERROR is not None:
            payload['error'] = str(RAG_INIT_ERROR)
        return jsonify(payload)

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
    query = request.args.get('q', '').strip()
    top_k = int(request.args.get('top_k', 5))

    if not query:
        return jsonify({'success': False, 'error': 'Missing query parameter ?q='}), 400

    try:
        current_rag = get_rag()
        results = current_rag.retriever.search(query, top_k=top_k)
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
    except RuntimeError as e:
        return rag_not_ready_response(e)
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
    data = request.get_json(silent=True) or {}
    session_id = data.get('session_id')
    message = (data.get('message') or '').strip()
    top_k = int(data.get('top_k', 5))

    if not session_id:
        return jsonify({'success': False, 'error': 'session_id is required'}), 400
    if not message:
        return jsonify({'success': False, 'error': 'message is required'}), 400

    try:
        current_rag = get_rag()
        result = current_rag.chat(session_id=session_id, user_query=message, top_k=top_k)
        # rag.chat() already returns a clean dict; just wrap with success flag
        return jsonify({'success': True, **result})
    except RuntimeError as e:
        return rag_not_ready_response(e)
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
    data = request.get_json(silent=True) or {}
    session_id = data.get('session_id')
    if not session_id:
        return jsonify({'success': False, 'error': 'session_id is required'}), 400

    try:
        current_rag = get_rag()
        current_rag.reset_session(session_id)
        return jsonify({'success': True, 'session_id': session_id})
    except RuntimeError as e:
        return rag_not_ready_response(e)


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
    context_id = request.args.get('context_id', '').strip()
    if not context_id:
        return jsonify({'success': False, 'error': 'context_id is required'}), 400

    try:
        current_rag = get_rag()
        product_lookups = current_rag.get_context_products(context_id)
        if product_lookups is None:
            return jsonify({'success': False, 'error': 'Context not found or expired'}), 404

        products_used = current_rag.mongo_resolver.fetch_for_display(product_lookups)
        return jsonify({'success': True, 'products_used': products_used})
    except RuntimeError as e:
        return rag_not_ready_response(e)
    except Exception as e:
        print(f"[recipe_products] ERROR: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    print(f"Starting ML/AI Service on port {ML_SERVICE_PORT}")
    print("Available endpoints:")
    print("  GET  /health - Health check")
    print("  GET  /api/weekly-specials - Get this week's top specials")
    print("  POST /api/ml/recommendations - Get product recommendations")
    print("  POST /api/ml/price-prediction - Predict future prices")
    print("  POST /api/ocr/receipt - Process uploaded receipt image")
    print("  GET  /api/recipe/stats - Recipe RAG diagnostics")
    print("  GET  /api/recipe/search?q=... - Recipe retrieval (no LLM)")
    print("  POST /api/recipe/chat - Recipe RAG chat (full LLM)")
    print("  POST /api/recipe/reset - Wipe a chat session")
    print("  GET  /api/recipe/products?context_id=... - Fetch product cards for a chat turn")
    app.run(host='0.0.0.0', port=ML_SERVICE_PORT, debug=False)
