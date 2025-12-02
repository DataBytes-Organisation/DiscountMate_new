# ML/AI Service for DiscountMate

This Python Flask service provides ML/AI endpoints for the DiscountMate application.

## Setup

### Quick Start (Recommended)

Use the start script which handles virtual environment setup:
```bash
chmod +x start.sh
./start.sh
```

### Manual Setup

1. **Create and activate virtual environment** (required to avoid "externally-managed-environment" error):
```bash
python3 -m venv venv
source venv/bin/activate
```

2. **Install dependencies**:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

3. **Set environment variables** (optional):
```bash
export ML_SERVICE_PORT=5001
```

4. **Run the service**:
```bash
python app.py
```

The service will start on `http://localhost:5001`

### Troubleshooting

If you get "externally-managed-environment" error, you **must** use a virtual environment. See `SETUP.md` for detailed troubleshooting.

## Endpoints

### Health Check
- `GET /health` - Check if the service is running

### Weekly Specials
- `GET /api/weekly-specials?limit=4&category=Pantry` - Get this week's top specials

### ML Endpoints (to be implemented)
- `POST /api/ml/recommendations` - Get product recommendations
- `POST /api/ml/price-prediction` - Predict future prices

## Integrating Your ML Models

To integrate your Python notebooks:

1. **Export your models**: Save trained models using pickle, joblib, or model-specific formats
2. **Create model loading functions**: Load models in `app.py`
3. **Connect to data sources**: Connect to MongoDB or load data files
4. **Replace placeholder functions**: Update `generate_weekly_specials_placeholder()` with your actual ML logic

### Example Integration

```python
import joblib
import pandas as pd
from pymongo import MongoClient

# Load your trained model
model = joblib.load('path/to/your/model.pkl')

# Connect to MongoDB
client = MongoClient('your_connection_string')
db = client['your_database']
products = db['product']

# Use model for predictions
def get_weekly_specials_ml(limit=4):
    # Fetch products from database
    product_data = pd.DataFrame(list(products.find()))

    # Run ML model predictions
    predictions = model.predict(product_data)

    # Rank and return top deals
    # ... your logic here
    return top_specials
```

## Connecting Notebooks

To use code from your Jupyter notebooks:

1. Extract the relevant functions from your notebooks
2. Create Python modules (`.py` files) with those functions
3. Import and use them in `app.py`

Example:
```python
# In ml_models/weekly_specials.py
def predict_top_specials():
    # Your notebook code here
    pass

# In app.py
from ml_models.weekly_specials import predict_top_specials
```

