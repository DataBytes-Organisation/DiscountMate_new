#!/bin/bash

cd E:/Automation_DiscountMate/
source venv/bin/activate

# Run the scraping scripts
python scripts/scraper_coles.py
python scripts/scraper_foodland.py
python scripts/scraper_iga.py
python scripts/scraper_woolworths.py

# Convert and run the Jupyter Notebook
jupyter nbconvert --to python scripts/scrapping_aldi.ipynb
python scripts/scrapping_aldi.py

deactivate