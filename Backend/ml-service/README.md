# ML/AI Service for DiscountMate

Python Flask service that provides ML/AI endpoints for the DiscountMate application, connecting your Python notebooks and trained models to the web application.

## Table of Contents

1. [NativeWind Setup](#1-nativewind-setup)
2. [Python Flask Setup](#2-python-flask-setup)
3. [Architecture Overview](#architecture-overview)
4. [Quick Start](#quick-start)
5. [API Endpoints](#api-endpoints)
6. [Reverse Image Search](#reverse-image-search)
7. [Integrating ML Models](#integrating-ml-models)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)
10. [Next Steps](#next-steps)
11. [Service Management with manage.sh](#service-management-with-managesh)



## 1. NativeWind Setup

NativeWind is already configured in the Frontend. After pulling the latest changes, you only need to install dependencies:

```bash
cd Frontend
npm install
# or if using yarn:
yarn install
```

That's it! All configuration files (babel.config.js, tailwind.config.js, postcss.config.js, global.css) are already committed to the repository.

**No additional setup required** - NativeWind will work immediately after installing dependencies.



## 2. Python Flask Setup

### Prerequisites

Before setting up the Flask service, ensure you have:

- **Python 3.10-3.12** installed. Avoid Python 3.13 for now because some pinned ML dependencies may fail to install.
- **python3-venv** package (for creating virtual environments)

#### Installing Prerequisites

**Windows:**
1. Download Python 3.10, 3.11, or 3.12 from [python.org](https://www.python.org/downloads/)
2. During installation, check **"Add Python to PATH"**
3. Verify installation:
   ```bash
   python --version
   ```
4. Python's `venv` module is included by default with Python 3.10-3.12

**macOS:**
1. Python 3 is usually pre-installed. Check version:
   ```bash
   python3 --version
   ```
2. If not installed or outdated, use Homebrew:
   ```bash
   brew install python3
   ```
3. Python's `venv` module is included by default

**WSL / Linux (Debian/Ubuntu):**
```bash
sudo apt update
sudo apt install python3 python3-venv python3-full
```

Verify installation:
```bash
python3 --version
python3 -m venv --help
```

### Installation Steps

#### Option 1: Using Start Script (Recommended)

```bash
cd Backend/ml-service
./start.sh
```

**Note about `chmod +x start.sh`:**
- **When needed**: If you get a "Permission denied" error when running `./start.sh`, you need to make it executable first:
  ```bash
  chmod +x start.sh
  ./start.sh
  ```
- **When not needed**: If the file already has execute permissions (common on Linux/WSL), you can run `./start.sh` directly
- **Alternative**: You can always run the script without execute permissions using:
  ```bash
  bash start.sh
  ```

The `start.sh` script will:
- Check if Python 3 and python3-venv are installed
- Create a virtual environment if it doesn't exist
- Activate the virtual environment
- Upgrade pip
- Install all dependencies from `requirements.txt`
- Start the Flask service on port 5001

The service will run in the foreground (you'll see logs in the terminal). Press `Ctrl+C` to stop it.

#### Option 2: Manual Setup

1. **Create virtual environment**:
   ```bash
   cd Backend/ml-service
   python3 -m venv venv
   ```

2. **Activate virtual environment**:
   ```bash
   # On Windows (Command Prompt):
   venv\Scripts\activate

   # On Windows (PowerShell):
   venv\Scripts\Activate.ps1

   # On macOS/Linux/WSL:
   source venv/bin/activate
   ```
   You should see `(venv)` in your prompt.

3. **Install dependencies**:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Run the service**:
   ```bash
   python app.py
   ```

The service will start on `http://localhost:5001`

### Environment Variables (Optional)

Create a `.env` file in `Backend/ml-service/`:

```env
ML_SERVICE_PORT=5001
MONGO_URI=your_mongodb_connection_string
MONGO_DB=your_database_name
```

### Analytics Service

The `Backend/analytics-service` uses the **exact same setup process** as the ML service:
- Same prerequisites (Python 3.10-3.12, python3-venv)
- Same installation steps (use `./start.sh` or manual setup)
- Same virtual environment structure
- Runs on port 5002 instead of 5001

Simply follow the same instructions in the `analytics-service` directory.



## Architecture Overview

```
Frontend (React Native / Web)
    ↓
Node.js Backend (Express) - Port 8080
    ├── → Python ML Service (Flask)         - Port 5001  [manual start]
    └── → Reverse Image Search (FastAPI)    - Port 8001  [auto-spawned by Node.js]
              ↓
         FAISS index + DINOv2 (ml_models/)
```

**Separation of Concerns:**
- `app.py` - Flask API server (OCR, recommendations, weekly specials)
- `ml_models/` - ML logic, trained models, and FAISS artifacts
- `reverse_image_search/` - FastAPI sidecar; auto-started by `node server.js`



## Quick Start

### Start the ML Service

```bash
cd Backend/ml-service
./start.sh
```

### Start the Node.js Backend

```bash
cd Backend
node server.js
```

### Test the Integration

```bash
# Health check
curl http://localhost:5001/health

# Weekly specials
curl 'http://localhost:5001/api/weekly-specials?limit=4'

# Through Node.js backend (port 3000 per .env.example; 8080 when no .env is set)
curl 'http://localhost:3000/api/ml/weekly-specials?limit=4'
```



## API Endpoints

### Health Check
- `GET /health` - Check if the service is running

### Weekly Specials
- `GET /api/weekly-specials?limit=4&category=Pantry` - Get this week's top specials

### Product Recommendations
- `POST /api/ml/recommendations` - Get product recommendations using ML model
  ```json
  {
    "product_id": 21137,
    "limit": 5
  }
  ```

### Price Prediction (To be implemented)
- `POST /api/ml/price-prediction` - Predict future prices

### Reverse Image Search (FastAPI — Port 8001)
- `GET  /health` - Health check for the sidecar
- `POST /reverse-image-search?top_k=5` - Upload a product image, get the top-K matching products
  - `top_k`: integer 1–20 (default 5); returns HTTP 400 if out of range
  - Maximum upload size: 10 MB; returns HTTP 413 if exceeded
  - Body: `multipart/form-data` with field `file` (image/*)
  - Response: ranked list of `{ rank, product_id, name, similarity_score, image_url, mongo_id, price_now, woolworths_price, iga_price }`
- Via Node.js proxy: `POST /api/reverse-image-search` → forwarded to port 8001



## Reverse Image Search

The reverse image search feature lives in `reverse_image_search/` inside this service. It is a **FastAPI + Uvicorn** app (separate from the Flask `app.py`) that runs on **port 8001** and is **automatically spawned by `node server.js`** — you do not need to start it manually.

### How it works

1. User uploads a product image via the Node.js API (`POST /api/reverse-image-search`)
2. Node.js proxies the image to the FastAPI sidecar on port 8001
3. The sidecar extracts a 768-dim embedding using **DINOv2 ViT-B/14** with 5 test-time augmentations
4. A prebuilt **FAISS HNSW index** is downloaded from Google Cloud Storage on startup and cached locally
5. Results are deduplicated by product and ranked by similarity score
6. Node.js enriches the results with live pricing from MongoDB before returning them

### Files

| File | Purpose |
|------|---------|
| `reverse_image_search/api.py` | FastAPI app — routes, request validation, response models |
| `reverse_image_search/notebook_runtime.py` | Search engine — DINOv2 embedder, FAISS search, TTA augmentations |
| `ml_models/reverse_image_search.faiss` | Local development cache for the downloaded FAISS HNSW index; ignored by Git |
| `ml_models/reverse_image_search_metadata.json` | Product metadata for each indexed vector (~33 MB) |

### FAISS index download

The FAISS index is not stored in Git. On startup, `reverse_image_search/notebook_runtime.py` downloads it from Google Cloud Storage if the cache file is missing.

Configure these values in `Backend/.env`:

```env
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
FAISS_GCP_PROJECT=
FAISS_QUOTA_PROJECT=
FAISS_BUCKET_NAME=discountmate-ml-models
FAISS_OBJECT_NAME=reverse_image_search.faiss
```

`FAISS_GCP_PROJECT` is optional. Leave it blank unless the FAISS bucket lives in a different project from `GOOGLE_CLOUD_PROJECT`.
`FAISS_QUOTA_PROJECT` is optional and defaults to the same project. Set it only if your local Google ADC quota/billing project should be different.

Default cache paths:

| Runtime | Cache path |
|---------|------------|
| Local machine | `Backend/ml-service/ml_models/reverse_image_search.faiss` |
| Cloud Run / App Engine | `/tmp/reverse_image_search.faiss` |

You can override the cache path with `LOCAL_FAISS_PATH`.

For local GCS access, authenticate once:

```bash
gcloud auth login
gcloud auth application-default login
gcloud auth application-default set-quota-project your-gcp-project-id
```

### First-run note

On first startup, DINOv2 (~330 MB) is downloaded from Torch Hub and the FAISS index is downloaded from GCS. This can take a few minutes. Subsequent runs use the local caches.

### Rebuilding the index

The FAISS index is built by the notebooks in `ML/ReverseImageSearch/`. Run those notebooks if you need to re-index products, then upload the rebuilt `reverse_image_search.faiss` file to `gs://discountmate-ml-models/reverse_image_search.faiss`.

### Testing

```bash
# Health check (direct to sidecar)
curl http://localhost:8001/health

# Search by image (direct to sidecar)
curl -X POST "http://localhost:8001/reverse-image-search?top_k=5" \
  -F "file=@/path/to/product.jpg"

# Search via Node.js proxy (includes MongoDB price enrichment)
curl -X POST "http://localhost:3000/api/reverse-image-search" \
  -F "file=@/path/to/product.jpg"
```



## Integrating ML Models

### Current Implementation

The service demonstrates two integration patterns:

1. **Simple Demo** (`ml_models/weekly_specials.py`):
   - Returns placeholder data
   - Shows the basic structure

2. **Real Model Integration** (`ml_models/recommendations.py`):
   - Loads actual joblib model: `product_recommendation_model.joblib`
   - Demonstrates using existing trained models
   - Shows how to handle model dependencies

### Step 1: Export Your Model

From your Jupyter notebook, save your trained model:

```python
# Scikit-learn model
import joblib
joblib.dump(trained_model, 'models/weekly_specials_model.pkl')

# TensorFlow/Keras model
model.save('models/weekly_specials_model.h5')

# PyTorch model
torch.save(model.state_dict(), 'models/weekly_specials_model.pth')
```

### Step 2: Create a Model Module

Create a new file in `ml_models/` (e.g., `ml_models/your_model.py`):

```python
import pandas as pd
import joblib
from pymongo import MongoClient

# Load your model
model = joblib.load('path/to/your/model.pkl')

# Connect to MongoDB (if needed)
client = MongoClient('your_connection_string')
db = client['your_database']
products_collection = db['product']

def get_predictions(limit=4, category=None):
    # 1. Fetch product data
    products = pd.DataFrame(list(products_collection.find()))

    # 2. Prepare features (same as training)
    features = prepare_features(products)

    # 3. Run predictions
    predictions = model.predict(features)

    # 4. Rank and format results
    products['prediction_score'] = predictions
    top_products = products.nlargest(limit, 'prediction_score')

    # 5. Format for API
    return format_results(top_products)
```

### Step 3: Update app.py

```python
from ml_models.your_model import get_predictions

@app.route('/api/your-endpoint', methods=['GET'])
def your_endpoint():
    results = get_predictions(limit=4)
    return jsonify({'success': True, 'data': results})
```

### Example: Using Existing Models

See `ml_models/recommendations.py` for a complete example of:
- Loading a joblib model
- Handling model dependencies
- Creating mock data for demo
- Error handling and fallbacks



## Testing

### Test ML Service Directly

```bash
# Health check
curl http://localhost:5001/health

# Weekly specials
curl 'http://localhost:5001/api/weekly-specials?limit=4'

# Recommendations
curl -X POST http://localhost:5001/api/ml/recommendations \
  -H "Content-Type: application/json" \
  -d '{"product_id": 21137, "limit": 5}'
```

### Test Through Node.js Backend

```bash
curl 'http://localhost:8080/api/ml/weekly-specials?limit=4'
```

### Using Postman

1. **Method**: `POST`
2. **URL**: `http://localhost:5001/api/ml/recommendations`
3. **Headers**: `Content-Type: application/json`
4. **Body** (raw JSON):
   ```json
   {
     "product_id": 21137,
     "limit": 5
   }
   ```



## Troubleshooting

### Service Won't Start

**"externally-managed-environment" Error:**
- **Solution**: Always use a virtual environment
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  ```

**"python3-venv" Not Found:**
- **Solution**: Install it
  - **WSL/Linux**: `sudo apt install python3-venv python3-full`
  - **Windows**: Reinstall Python and ensure "Add Python to PATH" is checked
  - **macOS**: `brew install python3`

**Port 5001 is in use:**
- **Solution**:
  ```bash
  # Use manage.sh if available
  ./manage.sh stop
  # or manually
  kill $(lsof -ti :5001)  # Linux/WSL/macOS
  # On Windows, use Task Manager or:
  netstat -ano | findstr :5001
  taskkill /PID <PID> /F
  ```

**Import errors:**
- **Solution**: Ensure virtual environment is activated and dependencies installed
  ```bash
  source venv/bin/activate
  pip install -r requirements.txt
  ```

### Connection Refused

- Ensure the service is running: `./manage.sh status` (if using manage.sh)
- Check port: `lsof -i :5001` (Linux/WSL/macOS) or `netstat -ano | findstr :5001` (Windows)
- Verify Node.js backend can reach it: `curl http://localhost:5001/health`
- Check `ML_SERVICE_URL` in Node.js backend matches the Python service port

### Model Loading Errors

- Ensure model files are in the correct path
- Check model file format matches the loading method
- Verify all dependencies are installed (e.g., `joblib` for .joblib files)
- Check model file permissions

### Virtual Environment Issues

**Not activating:**
```bash
cd Backend/ml-service
source venv/bin/activate  # Linux/WSL/macOS
# or
venv\Scripts\activate     # Windows
which python  # Should show venv/bin/python (Linux/WSL/macOS)
where python  # Should show venv\Scripts\python.exe (Windows)
```

**Dependencies not found:**
- Ensure venv is activated (you should see `(venv)` in prompt)
- Reinstall: `pip install -r requirements.txt`

**Wrong Python used by reverse image search sidecar:**
- `node server.js` automatically uses `Backend/ml-service/venv/bin/python` when that virtual environment exists.
- If your machine has multiple Python installs and the sidecar starts with the wrong one, set `RIS_PYTHON` in `Backend/.env`:
  ```env
  RIS_PYTHON=/absolute/path/to/your/python
  ```
- This is optional and usually only needed for local machines with multiple Python versions.



## Next Steps

1. ✅ **Service is running** - Basic setup complete
2. 🔄 **Integrate your ML models** - Replace placeholder functions with real models
3. 🔄 **Connect to MongoDB** - Load real product data instead of mock data
4. 🔄 **Add more endpoints** - Price prediction, smart substitutions, etc.
5. 🔄 **Add caching** - Cache predictions for better performance
6. 🔄 **Add authentication** - Secure your ML endpoints if needed
7. 🔄 **Deploy to production** - Consider Docker for containerization



## Running All Services

For the full application, you need the following services running:

### Terminal 1: Python ML Service (Flask — port 5001)
```bash
cd Backend/ml-service
./start.sh
```
✅ Runs on: `http://localhost:5001`
Provides: OCR, recommendations, weekly specials

### Terminal 2: Node.js Backend (port from `PORT` in `Backend/.env`; `.env.example` uses 3000)
```bash
cd Backend
node server.js
```
✅ Runs on: `http://localhost:3000` when using the provided `.env.example` (code falls back to 8080 if `PORT` is unset)

> **Note:** `node server.js` automatically spawns the Reverse Image Search FastAPI sidecar on port 8001 before Express starts accepting traffic. You do **not** need a separate terminal for it.

### Terminal 3: Frontend (if using Expo/React Native)
```bash
cd Frontend
npm start
# or
npx expo start
```



## Service Management with manage.sh

The `manage.sh` script provides production-like service management capabilities. It's useful when you want to run the service in the background and manage it separately.

### What does `manage.sh` do differently?

**`./start.sh`** (recommended for development):
- Runs the service in the **foreground** (blocks the terminal)
- Shows logs directly in the terminal
- Simple: just run and see output
- Stop with `Ctrl+C`

**`./manage.sh start`** (useful for background operation):
- Runs the service in the **background** (detached process)
- Logs are written to `ml-service.log` file
- Terminal remains free for other commands
- Tracks the process with a PID file
- Checks if port 5001 is already in use before starting
- Provides status checking and process management

### Using manage.sh

```bash
cd Backend/ml-service

# Start the service in background
./manage.sh start

# Check if service is running
./manage.sh status

# Stop the service
./manage.sh stop

# Restart the service
./manage.sh restart
```

### Viewing Logs

When using `manage.sh start`, logs are written to `ml-service.log`:

```bash
# View logs in real-time
tail -f ml-service.log

# View last 50 lines
tail -n 50 ml-service.log

# View entire log file
cat ml-service.log
```

### When to use manage.sh vs start.sh

- **Use `./start.sh`**: For development, testing, or when you want to see logs in real-time
- **Use `./manage.sh start`**: When you want to run the service in the background, need the terminal for other tasks, or want production-like process management

### Manual Port Management

**Check what's using port 5001:**
```bash
# Linux/WSL/macOS:
lsof -i :5001
# or
netstat -tulpn | grep 5001

# Windows:
netstat -ano | findstr :5001
```

**Stop the service manually:**
```bash
# Linux/WSL/macOS:
kill $(lsof -ti :5001)

# Windows:
# Find PID from netstat, then:
taskkill /PID <PID> /F
```

**Change the port:**
1. **Environment variable**:
   ```bash
   ML_SERVICE_PORT=5002 python app.py
   ```

2. **Update Node.js backend** (if port changed):
   ```bash
   ML_SERVICE_URL=http://localhost:5002 node server.js
   ```

**Common ports:**
- Port 5001: ML Service / Flask (default)
- Port 5002: Analytics Service (default)
- Port 8001: Reverse Image Search / FastAPI (auto-spawned by Node.js)
- Port 3000: Node.js Backend locally when `Backend/.env` has `PORT=3000` (the provided `.env.example` uses this)
- Port 8080: Node.js Backend on GCP App Engine and when no `PORT` env var is set
- Port 5000: Sometimes used by other Flask apps



## File Structure

```
Backend/ml-service/
├── app.py                    # Flask API server (OCR, recommendations, weekly specials)
├── requirements.txt          # Python dependencies (Flask + FastAPI/torch/faiss)
├── manage.sh                 # Service management script (background)
├── start.sh                  # Quick start script (foreground)
├── ml_models/
│   ├── __init__.py
│   ├── weekly_specials.py                    # Weekly specials logic
│   ├── recommendations.py                    # Product recommendations (joblib model)
│   ├── reverse_image_search.faiss            # Downloaded FAISS cache, ignored by Git
│   └── reverse_image_search_metadata.json   # Product metadata for indexed vectors
├── reverse_image_search/
│   ├── __init__.py
│   ├── api.py                # FastAPI app — routes, validation, response models
│   └── notebook_runtime.py  # DINOv2 embedder, FAISS search, TTA augmentations
├── ocr/
│   ├── __init__.py
│   ├── extractor.py
│   ├── matcher.py
│   ├── parser.py
│   └── preprocess.py
└── venv/                     # Virtual environment (gitignored)
```



## Additional Resources

- Flask Documentation: https://flask.palletsprojects.com/
- MongoDB Python Driver: https://pymongo.readthedocs.io/
- Model Serialization: https://scikit-learn.org/stable/modules/model_persistence.html
- Joblib Documentation: https://joblib.readthedocs.io/
