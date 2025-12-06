#!/bin/bash

# Quick start script for ML Service
# This script helps you start the Python ML service

echo "Starting DiscountMate ML/AI Service..."
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed"
    exit 1
fi

# Check if python3-venv is available
if ! python3 -m venv --help &> /dev/null; then
    echo "Error: python3-venv is not installed"
    echo "Please install it with: sudo apt install python3-venv python3-full"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "Error: Failed to create virtual environment"
        echo "Try installing: sudo apt install python3-venv python3-full"
        exit 1
    fi
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "Error: Failed to install dependencies"
    exit 1
fi

# Start the service
echo ""
echo "Starting ML Service on port 5001..."
echo "API will be available at: http://localhost:5001"
echo "Press Ctrl+C to stop the service"
echo ""
python app.py

