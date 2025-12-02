# ML Service Setup Guide

## Quick Setup

### Option 1: Using the Start Script (Recommended)

```bash
cd Backend/ml-service
chmod +x start.sh
./start.sh
```

### Option 2: Manual Setup

#### Step 1: Install Python venv (if not already installed)

On Debian/Ubuntu/WSL:
```bash
sudo apt install python3-venv python3-full
```

#### Step 2: Create Virtual Environment

```bash
cd Backend/ml-service
python3 -m venv venv
```

#### Step 3: Activate Virtual Environment

```bash
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt.

#### Step 4: Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

#### Step 5: Run the Service

```bash
python app.py
```

## Troubleshooting

### "externally-managed-environment" Error

This error occurs on newer Linux systems. **Always use a virtual environment**:

```bash
# Create venv
python3 -m venv venv

# Activate it
source venv/bin/activate

# Now pip install will work
pip install -r requirements.txt
```

### "python3-venv" Not Found

Install it:
```bash
sudo apt install python3-venv python3-full
```

### "python: command not found"

Use `python3` instead:
```bash
python3 -m venv venv
python3 app.py
```

### Virtual Environment Not Activating

Make sure you're in the correct directory:
```bash
cd Backend/ml-service
source venv/bin/activate
```

Check if activation worked:
```bash
which python  # Should show path to venv/bin/python
```

## Running the Service

Once set up, you can run the service:

```bash
# Activate virtual environment (if not already active)
source venv/bin/activate

# Run the service
python app.py
```

The service will start on `http://localhost:5001`

## Deactivating Virtual Environment

When you're done:
```bash
deactivate
```

## Next Steps

After the service is running, start the Node.js backend:

```bash
cd Backend
node server.js
```

Then your frontend can connect to the ML service through the backend API.

