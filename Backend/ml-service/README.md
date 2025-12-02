# ML/AI Service for DiscountMate

Python Flask service that provides ML/AI endpoints for the DiscountMate application, connecting your Python notebooks and trained models to the web application.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start](#quick-start)
3. [Setup & Installation](#setup--installation)
4. [Service Management](#service-management)
5. [API Endpoints](#api-endpoints)
6. [Integrating ML Models](#integrating-ml-models)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)
9. [Next Steps](#next-steps)

## Architecture Overview

```
Frontend (React Native)
    ↓
Node.js Backend (Express) - Port 3000
    ↓
Python ML Service (Flask) - Port 5001
    ↓
Your ML Models & Notebooks
```

**Separation of Concerns:**
- `app.py` - Handles HTTP requests/responses (API layer)
- `ml_models/` - Contains ML logic and model integrations (business logic layer)

## Quick Start

### Start the ML Service

```bash
cd Backend/ml-service
./manage.sh start    # Recommended - handles everything
# OR
./start.sh           # Alternative script
# OR manually:
source venv/bin/activate
python app.py
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

# Through Node.js backend
curl 'http://localhost:3000/api/ml/weekly-specials?limit=4'
```

## Setup & Installation

### Prerequisites

- Python 3.8+ installed
- `python3-venv` package (for virtual environment)

### Installation Steps

#### Option 1: Using Start Script (Recommended)

```bash
cd Backend/ml-service
chmod +x start.sh
./start.sh
```

#### Option 2: Manual Setup

1. **Install Python venv** (if not already installed):
   ```bash
   sudo apt install python3-venv python3-full  # Debian/Ubuntu/WSL
   ```

2. **Create virtual environment**:
   ```bash
   cd Backend/ml-service
   python3 -m venv venv
   ```

3. **Activate virtual environment**:
   ```bash
   source venv/bin/activate
   ```
   You should see `(venv)` in your prompt.

4. **Install dependencies**:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

5. **Run the service**:
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

## Service Management

### Using Management Script (Recommended)

```bash
cd Backend/ml-service

./manage.sh status   # Check if service is running
./manage.sh start    # Start the service
./manage.sh stop     # Stop the service
./manage.sh restart  # Restart the service
```

### Manual Management

**Check what's using port 5001:**
```bash
lsof -i :5001
# or
netstat -tulpn | grep 5001
```

**Stop the service:**
```bash
kill $(lsof -ti :5001)
```

### Port Management

**Port 5001 is in use?**
- Check status: `./manage.sh status`
- Stop existing: `./manage.sh stop`
- Or change port: `ML_SERVICE_PORT=5002 python app.py`

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
- Port 5001: ML Service (default)
- Port 3000: Node.js Backend
- Port 5000: Sometimes used by other Flask apps

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
curl 'http://localhost:3000/api/ml/weekly-specials?limit=4'
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
  ```bash
  sudo apt install python3-venv python3-full
  ```

**Port 5001 is in use:**
- **Solution**:
  ```bash
  ./manage.sh stop
  # or
  kill $(lsof -ti :5001)
  ```

**Import errors:**
- **Solution**: Ensure virtual environment is activated and dependencies installed
  ```bash
  source venv/bin/activate
  pip install -r requirements.txt
  ```

### Connection Refused

- Ensure the service is running: `./manage.sh status`
- Check port: `lsof -i :5001`
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
source venv/bin/activate
which python  # Should show venv/bin/python
```

**Dependencies not found:**
- Ensure venv is activated (you should see `(venv)` in prompt)
- Reinstall: `pip install -r requirements.txt`

## Next Steps

1. ✅ **Service is running** - Basic setup complete
2. 🔄 **Integrate your ML models** - Replace placeholder functions with real models
3. 🔄 **Connect to MongoDB** - Load real product data instead of mock data
4. 🔄 **Add more endpoints** - Price prediction, smart substitutions, etc.
5. 🔄 **Add caching** - Cache predictions for better performance
6. 🔄 **Add authentication** - Secure your ML endpoints if needed
7. 🔄 **Deploy to production** - Consider Docker for containerization

## Running All Services

For the full application, you need **3 services** running:

### Terminal 1: Python ML Service
```bash
cd Backend/ml-service
source venv/bin/activate
python app.py
```
✅ Runs on: `http://localhost:5001`

### Terminal 2: Node.js Backend
```bash
cd Backend
node server.js
```
✅ Runs on: `http://localhost:3000`

### Terminal 3: Frontend (if using Expo/React Native)
```bash
cd Frontend
npm start
# or
expo start
```

## File Structure

```
Backend/ml-service/
├── app.py                    # Flask API server
├── requirements.txt          # Python dependencies
├── manage.sh                 # Service management script
├── start.sh                  # Quick start script
├── ml_models/
│   ├── __init__.py
│   ├── weekly_specials.py    # Simple demo (placeholder)
│   └── recommendations.py    # Real model integration example
└── venv/                     # Virtual environment (gitignored)
```

## Additional Resources

- Flask Documentation: https://flask.palletsprojects.com/
- MongoDB Python Driver: https://pymongo.readthedocs.io/
- Model Serialization: https://scikit-learn.org/stable/modules/model_persistence.html
- Joblib Documentation: https://joblib.readthedocs.io/

## Quick Reference

| Task | Command |
|------|---------|
| Start service | `./manage.sh start` |
| Stop service | `./manage.sh stop` |
| Check status | `./manage.sh status` |
| Restart service | `./manage.sh restart` |
| Check port | `lsof -i :5001` |
| Kill process on port | `kill $(lsof -ti :5001)` |
| Activate venv | `source venv/bin/activate` |
| Install dependencies | `pip install -r requirements.txt` |
