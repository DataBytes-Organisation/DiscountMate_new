#!/bin/bash

set -e  # Exit if any command fails

# Navigate to the script's directory
cd "$(dirname "$0")"

# Step 1: Set up virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

# Step 2: Activate virtual environment
echo "Activating virtual environment..."
source .venv/bin/activate

# Step 3: Install dependencies if not already installed
echo "Installing dependencies..."
pip install --upgrade pip
pip install pymongo selenium beautifulsoup4 webdriver-manager pandas

# Step 4: Run the Python scraper
echo "Running IGA Scraper..."
python IGA_Scraper.py

echo "Scraper finished successfully."