# FoodlandScraper ReadMe

## Table of Contents
1. [Overview](#overview)  
2. [Dependencies](#dependencies)  
3. [Usage](#usage)  
4. [Features](#features)  
5. [Output](#output)  
6. [Need-to-Know Information](#need-to-know-information)  
7. [License](#license)

---

## Overview
**FoodlandScraper** is a Python-based web scraping tool designed to extract product details from two Foodland store websites:  
- **Foodland Balaklava** (`foodlandbalaklava.com.au`)  
- **Adelaide’s Finest** (`shop.adelaidesfinest.com.au`)  

The script collects product information such as name, prices, sizes, and links, compiles the data into a structured format, and saves it as a CSV file.

---

## Dependencies
The script requires the following Python packages:
- **`requests`**: For making HTTP requests to fetch webpage content.  
- **`BeautifulSoup`** (`bs4`): For parsing and navigating HTML content.  
- **`pandas`**: For data manipulation and exporting to CSV.  

### Install dependencies
Install these packages using `pip`:
```bash
pip install requests beautifulsoup4 pandas
```

---

## Usage
### Running the Script
1. Ensure you have Python installed (3.x recommended).
2. Save the script to a `.py` file (e.g., `FoodlandScraper.py`).
3. Run the script:
   ```bash
   python FoodlandScraper.py
   ```

### Expected Execution
- The script will fetch product details from the specified websites.  
- It handles pagination to scrape data from multiple pages.  
- After processing, the data is saved in a CSV file named `new_all_products.csv`.

---

## Features
1. **Custom User-Agent Headers**  
   Prevents potential blocking by servers.
   
2. **Pagination Support**  
   Automatically detects the number of pages to scrape.

3. **Flexible Data Extraction**  
   Handles missing or partial data gracefully using helper functions.

4. **Multiple Websites**  
   Scrapes data from both **Foodland Balaklava** and **Adelaide's Finest**.

5. **CSV Export**  
   Compiles all product data into a CSV file for easy analysis.

---

## Output
The final output is saved in a file called `new_all_products.csv`.  

### CSV File Structure
| Column Name        | Description                                                | Example                     |
|--------------------|------------------------------------------------------------|-----------------------------|
| `product_name`     | Name of the product                                        | "Milk Full Cream 1L"       |
| `discounted_price` | Discounted price, if available                             | "3.50"                     |
| `unit_price`       | Price per unit (e.g., per kg, per L), if available         | "2.50/kg"                  |
| `original_price`   | Original price before discount                             | "4.00"                     |
| `product_size`     | Size or quantity of the product                            | "1L"                       |
| `product_link`     | URL of the product’s page                                  | "https://foodlandbalaklava.com.au/example" |

---

## Need-to-Know Information
1. **Network Connection**: Ensure a stable internet connection to avoid request failures.
2. **Anti-Scraping Measures**:  
   - The script uses a standard user-agent header, but additional measures may be needed if the server blocks requests.
   - For large-scale scraping, consider introducing delays (`time.sleep`) between requests.
3. **Data Consistency**:  
   - Missing fields are replaced with `"N/A"`.
   - The script skips products where critical details (e.g., price or link) are entirely unavailable.
4. **Output File**:  
   - The output CSV overwrites existing files with the same name (`new_all_products.csv`).

---

## License
This script is free to use and modify. Please ensure compliance with the [website terms of service](https://www.foodland.com.au) before scraping data.