# FoodlandScraper README

## Table of Contents
1. [Overview](#overview)
2. [Dependencies](#dependencies)
3. [Usage](#usage)
4. [Features](#features)
5. [Output](#output)
6. [Database Integration](#database-integration)
7. [Notes](#notes)
8. [License](#license)

---

## Overview
**FoodlandScraper** is a Python-based tool designed to extract product data from the **Foodland Balaklava** website:  
('https://foodlandbalaklava.com.au')

It collects product information such as item name, prices, product codes, promo messages, and links. The data is then stored directly into DiscountMate's MongoDB collection 'Scrapped Data'

---

## Dependencies
Required Python packages:
- `requests`
- `beautifulsoup4`
- `pandas`
- `pymongo`

Install with:
```bash
pip install requests beautifulsoup4 pandas pymongo python-dotenv
```

---

## Usage
### Running the Script
```bash
python scraper_foodland.py
```
### Expected Execution
- Automatically detects and loops through all pages on Foodland Balaklava.
- Scraped results are uploaded to a timestamped MongoDB collection.

---

## Features
-**Dynamic Pagination**: Detects and scrapes through multiple pages.
-**Structured Output**: Extracts key product attributes:
  - `product_code`
  - `category`
  - `item_name`
  - `item_price`
  - `best_price`
  - `unit_price`
  - `special_text`
  - `promo_text`
  - `link`
-**MongoDB Integration**: Inserts directly into DiscountMate's MongoDB Atlas database.
-**Fail-Safe Defaults**: Missing fields are filled with `"N/A"`.

---

## Output
Data is stored in a MongoDB collection within the `ScrappedData` database.

**Collection Format:**
```
YYYY_MM_DD_HHMMSS_Foodland
```

Each document includes all scraped product attributes.

---
## Notes
- Make sure the site structure hasn’t changed. If so, update class selectors.
- Avoid overloading the server—add delays (`time.sleep`) for large scrapes.
- Ensure your MongoDB user has write access to `ScrappedData`.

---

## License
This script is free to use for educational or personal projects.
Always ensure compliance with [Foodland's website terms of service](https://www.foodland.com.au).