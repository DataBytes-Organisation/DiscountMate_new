# ML/AI Integration Summary

This document summarizes how to connect your Python notebooks to the DiscountMate application.

## What Was Created

### 1. Python Flask ML Service (`Backend/ml-service/`)
- **app.py**: Flask API service with endpoints for ML/AI features
- **requirements.txt**: Python dependencies
- **README.md**: Service documentation
- **INTEGRATION_GUIDE.md**: Detailed guide for integrating your models
- **start.sh**: Quick start script

### 2. Node.js Backend Integration
- **src/controllers/ml.controller.js**: Controller to connect to Python service
- **src/routers/ml.router.js**: API routes for ML endpoints
- **server.js**: Updated to include ML routes
- **package.json**: Added axios dependency

### 3. Frontend Integration
- **components/home/WeeklySpecialsSection.tsx**: Updated to fetch data from API

## API Endpoints

### Node.js Backend (Port 3000)
- `GET /api/ml/weekly-specials?limit=4&category=Pantry` - Get weekly specials
- `POST /api/ml/recommendations` - Get product recommendations
- `POST /api/ml/price-prediction` - Predict future prices

### Python ML Service (Port 5001)
- `GET /health` - Health check
- `GET /api/weekly-specials` - Weekly specials (ML-powered)
- `POST /api/ml/recommendations` - Recommendations (to be implemented)
- `POST /api/ml/price-prediction` - Price prediction (to be implemented)

## How to Use

### Step 1: Start Python ML Service

```bash
cd Backend/ml-service
pip install -r requirements.txt
python app.py
```

Or use the start script:
```bash
chmod +x start.sh
./start.sh
```

### Step 2: Start Node.js Backend

```bash
cd Backend
npm install  # Installs axios if needed
node server.js
```

### Step 3: Frontend Automatically Connects

The `WeeklySpecialsSection` component will automatically fetch data from:
```
http://localhost:3000/api/ml/weekly-specials
```

## Integrating Your ML Models

### Current Status
The service currently returns placeholder data. To use your actual ML models:

1. **Export your models** from your notebooks (save as .pkl, .h5, .pth, etc.)
2. **Create model modules** in `Backend/ml-service/ml_models/`
3. **Update `app.py`** to load and use your models
4. **Connect to your data sources** (MongoDB, CSV files, etc.)

### Example Integration

See `Backend/ml-service/INTEGRATION_GUIDE.md` for detailed examples including:
- Loading scikit-learn models
- Using TensorFlow/Keras models
- Integrating recommendation systems
- Price prediction models
- MongoDB connections

## File Structure

```
DiscountMate_new/
├── Backend/
│   ├── ml-service/
│   │   ├── app.py                    # Flask API service
│   │   ├── requirements.txt           # Python dependencies
│   │   ├── README.md                  # Service docs
│   │   ├── INTEGRATION_GUIDE.md       # Integration guide
│   │   ├── start.sh                   # Quick start script
│   │   └── ml_models/                 # (Create this) Your ML model modules
│   ├── src/
│   │   ├── controllers/
│   │   │   └── ml.controller.js        # ML controller
│   │   └── routers/
│   │       └── ml.router.js            # ML routes
│   └── server.js                       # Updated with ML routes
├── Frontend/
│   └── components/
│       └── home/
│           └── WeeklySpecialsSection.tsx  # Updated to fetch from API
└── ML/                                  # Your existing notebooks
```

## Next Steps

1. **Test the integration**: Start both services and verify the API works
2. **Choose a model**: Pick one of your ML notebooks to integrate first
3. **Export the model**: Save your trained model
4. **Create model module**: Extract prediction logic into a Python module
5. **Update app.py**: Replace placeholder with your model
6. **Test end-to-end**: Verify data flows from ML → Backend → Frontend

## Troubleshooting

### Service Won't Start
- Check if ports 3000 and 5001 are available
- Verify Python 3 is installed
- Install dependencies: `pip install -r requirements.txt`

### Connection Errors
- Ensure Python service is running on port 5001
- Check `ML_SERVICE_URL` in Node.js (default: `http://localhost:5001`)
- Verify CORS is enabled in Flask service

### Frontend Not Loading Data
- Check browser console for errors
- Verify backend is running on port 3000
- Check API_URL in `Frontend/constants/Api.ts`

## Support

For detailed integration instructions, see:
- `Backend/ml-service/INTEGRATION_GUIDE.md` - Complete integration guide
- `Backend/ml-service/README.md` - Service documentation

## Example Notebooks to Integrate

Based on your codebase, here are some notebooks you might want to integrate:

1. **Weekly Specials**:
   - `ML/Price-Prediction/Price_Prediction_by_Utkarsh/python_code.py` - Has weekly discount logic
   - `ML/Recommendation_system/` - Various recommendation models

2. **Price Predictions**:
   - `ML/Price-Prediction/LSTM_PricePrediction_Anju.ipynb`
   - `ML/Price-Prediction/price_prediction_by_anju/ARIMA/ARIMA.ipynb`
   - `DiscountMate_priceprediction_CNN.ipynb`

3. **Recommendations**:
   - `ML/Recommendation_system/Recommendation-by-Felix/Hybrid_recommendation_system.ipynb`
   - `ML/Recommendation_system/Recommendation-by-Likith/Personlization-based-Recommendation-using-BERT.ipynb`

