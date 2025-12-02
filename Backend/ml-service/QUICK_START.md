# Quick Start Guide

## ✅ Setup Complete!

Your ML service is now set up and running. Here's how to use it:

## Starting the Service

### Option 1: Use the Management Script (Recommended)
```bash
cd Backend/ml-service
./manage.sh start    # Start the service
./manage.sh status   # Check if running
./manage.sh stop     # Stop the service
```

### Option 2: Use the Start Script
```bash
cd Backend/ml-service
./start.sh
```

### Option 3: Manual Start
```bash
cd Backend/ml-service
source venv/bin/activate  # Activate virtual environment
python app.py
```

## Testing the Service

### Health Check
```bash
curl http://localhost:5001/health
```

### Get Weekly Specials
```bash
curl 'http://localhost:5001/api/weekly-specials?limit=4'
```

### Through Node.js Backend
```bash
curl 'http://localhost:3000/api/ml/weekly-specials?limit=4'
```

## Running All Services

You need **3 services** running for the full application:

### Terminal 1: Python ML Service
```bash
cd Backend/ml-service
source venv/bin/activate
python app.py
```
✅ Service runs on: `http://localhost:5001`

### Terminal 2: Node.js Backend
```bash
cd Backend
node server.js
```
✅ Service runs on: `http://localhost:3000`

### Terminal 3: Frontend (if using Expo/React Native)
```bash
cd Frontend
npm start
# or
expo start
```

## Important Notes

1. **Always activate the virtual environment** before running:
   ```bash
   source venv/bin/activate
   ```
   You'll see `(venv)` in your prompt when it's active.

2. **The service uses placeholder data** - Replace the functions in `app.py` with your actual ML models.

3. **Port 5001 must be available** - If it's in use:
   - Check status: `./manage.sh status`
   - Stop existing: `./manage.sh stop`
   - Or change port: `ML_SERVICE_PORT=5002 python app.py` (see `PORT_MANAGEMENT.md`)

## Next Steps

1. ✅ Service is running with placeholder data
2. 🔄 Integrate your ML models (see `INTEGRATION_GUIDE.md`)
3. 🔄 Connect to your MongoDB database
4. 🔄 Replace placeholder functions with real predictions

## Troubleshooting

**Service won't start?**
- Make sure virtual environment is activated: `source venv/bin/activate`
- Check if port 5001 is available: `lsof -i :5001`
- Verify dependencies: `pip list`

**Connection refused?**
- Ensure the service is running on port 5001
- Check the Node.js backend can reach it: `curl http://localhost:5001/health`

**Need help?**
- See `SETUP.md` for detailed setup instructions
- See `INTEGRATION_GUIDE.md` for ML model integration
- See `README.md` for API documentation

