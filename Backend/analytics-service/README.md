# Analytics Service

Python Flask API service for data processing, analysis, and reporting. This service provides endpoints for sales analysis, brand analysis, price comparison, and data cleaning operations.

## Architecture

```
Backend/
├── ml-service/          # ML/AI predictions (port 5001)
│   └── ml_models/       # ML model logic
│
└── analytics-service/   # Data analytics (port 5002)
    └── analytics/       # Analytics modules
```

**Separation of Concerns:**
- **ML Service**: Real-time predictions, recommendations, model inference
- **Analytics Service**: Data processing, batch analysis, reporting, ETL operations

## Quick Start

### 1. Setup and Start

```bash
cd Backend/analytics-service
./start.sh
```

This will:
- Create a Python virtual environment
- Install dependencies
- Start the service on port 5002

### 2. Verify Service is Running

```bash
curl http://localhost:5002/health
```

Or visit: http://localhost:5002/health

### Using a Different Port

```bash
ANALYTICS_SERVICE_PORT=5003 ./start.sh
```

## API Endpoints

### Health Check
```
GET /health
```

### Sales Summary
```
POST /api/analytics/sales-summary
```

**Request Body:**
```json
{
  "keyword": "chips",
  "store": "all"  // "all", "woolworths", "coles"
}
```

**Response:**
```json
{
  "success": true,
  "keyword": "chips",
  "store_filter": "all",
  "data": [
    {
      "item_name": "KB's Seafood Crumbed Squid Chips",
      "total_sold": 375,
      "unique_customers": 158,
      "store_count": 1,
      "stores": "Woolworths",
      "avg_price": 5.99,
      "is_top_seller": true
    }
  ],
  "count": 1
}
```

### Brand Analysis
```
POST /api/analytics/brand-analysis
```

**Request Body:**
```json
{
  "keyword": "milk",
  "top_n": 5
}
```

**Response:**
```json
{
  "success": true,
  "keyword": "milk",
  "brands": [
    {
      "brand": "Coles",
      "store": "Woolworths",
      "total_quantity": 500,
      "is_top_in_store": true
    }
  ],
  "count": 1
}
```

### Price Comparison
```
POST /api/analytics/price-comparison
```

**Request Body:**
```json
{
  "keyword": "eggs",
  "include_details": false
}
```

**Response:**
```json
{
  "success": true,
  "keyword": "eggs",
  "comparison": {
    "products_found": 15,
    "stores": {
      "Woolworths": {
        "item_name": "Free Range Eggs 12pk",
        "price": 4.50
      },
      "Coles": {
        "item_name": "Free Range Eggs 12pk",
        "price": 4.99
      }
    },
    "cheapest_overall": {
      "item_name": "Free Range Eggs 12pk",
      "store": "Woolworths",
      "price": 4.50
    },
    "price_difference": {
      "cheapest_store": "Woolworths",
      "cheapest_price": 4.50,
      "expensive_store": "Coles",
      "expensive_price": 4.99,
      "difference": 0.49,
      "savings_percentage": 9.82
    }
  }
}
```

### Data Cleaning
```
POST /api/analytics/data-cleaning
```

**Request Body:**
```json
{
  "data": [
    {
      "ItemName": "Product A",
      "Price": "$5.99",
      "Quantity": 10,
      "CustomerID": 123
    }
  ],
  "operations": ["remove_duplicates", "handle_missing", "standardize"]
}
```

**Response:**
```json
{
  "success": true,
  "original_count": 100,
  "cleaned_count": 95,
  "operations_applied": ["remove_duplicates", "handle_missing", "standardize"],
  "cleaned_data": [...]
}
```

## Accessing via Node.js Backend

The analytics service is integrated with the Node.js backend. Access endpoints via:

```
http://localhost:3000/api/analytics/sales-summary
http://localhost:3000/api/analytics/brand-analysis
http://localhost:3000/api/analytics/price-comparison
http://localhost:3000/api/analytics/data-cleaning
```

## Testing with Postman

1. **Start the analytics service:**
   ```bash
   cd Backend/analytics-service
   ./start.sh
   ```

2. **Test endpoints directly:**
   - Base URL: `http://localhost:5002`
   - Or via Node.js backend: `http://localhost:3000/api/analytics`

3. **Example Postman request:**
   - Method: `POST`
   - URL: `http://localhost:5002/api/analytics/sales-summary`
   - Headers: `Content-Type: application/json`
   - Body:
     ```json
     {
       "keyword": "chips",
       "store": "all"
     }
     ```

## Analytics Modules

### `analytics/sales_analysis.py`
- `get_sales_summary_by_keyword()`: Analyze sales by product keyword

### `analytics/brand_analysis.py`
- `get_top_brands_by_keyword()`: Identify top-selling brands
- `extract_brand()`: Extract brand name from product names

### `analytics/price_comparison.py`
- `compare_prices_by_keyword()`: Compare prices across stores

### `analytics/data_cleaning.py`
- `clean_transaction_data()`: Clean and preprocess transaction data
- Operations: remove duplicates, handle missing values, standardize formats

## Data Sources

The analytics modules expect transaction data files at:
- `Data Analysis/customer_transactions_woolies.csv`
- `Data Analysis/customer_transactions_coles.csv`

If these files are not found, the endpoints will return demo data with a note.

## Adding New Analytics Functions

1. **Create a new module** in `analytics/`:
   ```python
   # analytics/my_analysis.py
   def my_analysis_function(param1, param2):
       # Your analysis logic
       return results
   ```

2. **Import in `app.py`**:
   ```python
   from analytics.my_analysis import my_analysis_function
   ```

3. **Add endpoint**:
   ```python
   @app.route('/api/analytics/my-endpoint', methods=['POST'])
   def my_endpoint():
       data = request.get_json()
       result = my_analysis_function(data.get('param1'), data.get('param2'))
       return jsonify({'success': True, 'data': result})
   ```

4. **Add Node.js integration**:
   - Add controller method in `Backend/src/controllers/analytics.controller.js`
   - Add route in `Backend/src/routers/analytics.router.js`

## Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
lsof -i :5002  # Linux/WSL/macOS
# or
netstat -ano | findstr :5002  # Windows

# Stop the process manually
kill $(lsof -ti :5002)  # Linux/WSL/macOS
# or on Windows, find PID from netstat and:
taskkill /PID <PID> /F

# Or use a different port
ANALYTICS_SERVICE_PORT=5003 ./start.sh
```

### Service Won't Start
1. Check if virtual environment exists: `ls venv/`
2. If not, run `./start.sh` to create it
3. If using `manage.sh start`, check logs: `cat analytics-service.log`
4. Otherwise, logs appear directly in the terminal when using `./start.sh`

### Module Import Errors
- Ensure you're in the `analytics-service` directory
- Activate virtual environment: `source venv/bin/activate`
- Install dependencies: `pip install -r requirements.txt`

### Data Files Not Found
- The service will return demo data if actual data files are missing
- To use real data, ensure CSV files exist in `Data Analysis/` directory
- Update paths in analytics modules if your data is stored elsewhere

## Environment Variables

- `ANALYTICS_SERVICE_PORT`: Port to run the service on (default: 5002)
- `ANALYTICS_SERVICE_URL`: Used by Node.js backend to connect (default: http://localhost:5002)

## Dependencies

See `requirements.txt`:
- `flask`: Web framework
- `flask-cors`: CORS support
- `pandas`: Data manipulation
- `numpy`: Numerical operations

## Next Steps

- Connect to MongoDB for real-time data access
- Add caching for frequently requested analyses
- Implement batch processing endpoints for large datasets
- Add data export functionality (CSV, JSON, Excel)
- Integrate with visualization tools (Power BI, Looker Studio)

