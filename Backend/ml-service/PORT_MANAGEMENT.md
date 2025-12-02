# Port Management Guide

## What Was Running on Port 5001?

Port 5001 is used by the **Python ML/AI Service** (Flask application). If you see "Port 5001 is in use", it means the ML service is already running.

## Managing the Service

### Using the Management Script (Recommended)

```bash
cd Backend/ml-service

# Check status
./manage.sh status

# Start service
./manage.sh start

# Stop service
./manage.sh stop

# Restart service
./manage.sh restart
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
# Find and kill the process
kill $(lsof -ti :5001)

# Or if you know the PID
kill <PID>
```

## Changing the Port

If port 5001 is needed by another application, you can change the ML service port:

### Option 1: Environment Variable

```bash
cd Backend/ml-service
source venv/bin/activate
ML_SERVICE_PORT=5002 python app.py
```

### Option 2: Update Node.js Backend

If you change the Python service port, also update the Node.js backend:

1. Set environment variable when starting Node.js:
```bash
cd Backend
ML_SERVICE_URL=http://localhost:5002 node server.js
```

2. Or update `.env` file in Backend:
```env
ML_SERVICE_URL=http://localhost:5002
```

### Option 3: Update app.py Default

Edit `Backend/ml-service/app.py`:
```python
ML_SERVICE_PORT = int(os.getenv('ML_SERVICE_PORT', 5002))  # Changed from 5001
```

And update `Backend/src/controllers/ml.controller.js`:
```javascript
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5002';
```

## Common Port Conflicts

- **Port 5001**: ML Service (default)
- **Port 3000**: Node.js Backend
- **Port 5000**: Sometimes used by other Flask apps
- **Port 8080**: Common web server port

## Quick Reference

| Command | Description |
|---------|-------------|
| `./manage.sh status` | Check if service is running |
| `./manage.sh start` | Start the service |
| `./manage.sh stop` | Stop the service |
| `./manage.sh restart` | Restart the service |
| `lsof -i :5001` | See what's using port 5001 |
| `kill $(lsof -ti :5001)` | Kill process on port 5001 |

## Troubleshooting

**"Port 5001 is in use"**
- The ML service is already running
- Use `./manage.sh status` to check
- Use `./manage.sh stop` to stop it
- Or change to a different port

**"Connection refused"**
- Service is not running
- Use `./manage.sh start` to start it
- Check logs: `tail -f ml-service.log`

**Multiple processes on port 5001**
- This can happen if service was started multiple times
- Use `./manage.sh stop` to clean up
- Or manually: `kill $(lsof -ti :5001)`

