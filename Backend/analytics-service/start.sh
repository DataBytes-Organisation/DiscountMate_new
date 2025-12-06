#!/bin/bash

# Analytics Service Startup Script
# This script sets up and starts the Python Analytics service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Analytics Service Setup..."

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed or not in PATH"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip --quiet

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt --quiet

# Check if port is already in use
ANALYTICS_PORT=${ANALYTICS_SERVICE_PORT:-5002}
if lsof -Pi :$ANALYTICS_PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Warning: Port $ANALYTICS_PORT is already in use"
    echo "   You can stop the existing service with: ./manage.sh stop"
    echo "   Or use a different port: ANALYTICS_SERVICE_PORT=5003 ./start.sh"
    exit 1
fi

# Start the service
echo "✅ Starting Analytics Service on port $ANALYTICS_PORT..."
echo "   Endpoints will be available at: http://localhost:$ANALYTICS_PORT"
echo ""
echo "   Press Ctrl+C to stop the service"
echo ""

python app.py

