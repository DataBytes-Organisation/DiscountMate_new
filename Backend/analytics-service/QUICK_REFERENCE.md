# Analytics Service - Quick Reference

## Service Overview

**Port:** 5002 (default)
**Base URL:** `http://localhost:5002`
**Via Node.js:** `http://localhost:3000/api/analytics`

## Quick Commands

```bash
# Start service
cd Backend/analytics-service
./start.sh

# Or use management script
./manage.sh start

# Check status
./manage.sh status

# Stop service
./manage.sh stop
```

## Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/analytics/sales-summary` | POST | Sales analysis by keyword |
| `/api/analytics/brand-analysis` | POST | Top brands by keyword |
| `/api/analytics/price-comparison` | POST | Price comparison across stores |
| `/api/analytics/data-cleaning` | POST | Clean transaction data |

## Example Requests

### Sales Summary
```bash
curl -X POST http://localhost:5002/api/analytics/sales-summary \
  -H "Content-Type: application/json" \
  -d '{"keyword": "chips", "store": "all"}'
```

### Brand Analysis
```bash
curl -X POST http://localhost:5002/api/analytics/brand-analysis \
  -H "Content-Type: application/json" \
  -d '{"keyword": "milk", "top_n": 5}'
```

### Price Comparison
```bash
curl -X POST http://localhost:5002/api/analytics/price-comparison \
  -H "Content-Type: application/json" \
  -d '{"keyword": "eggs"}'
```

## File Structure

```
analytics-service/
├── app.py                 # Flask application
├── requirements.txt       # Python dependencies
├── start.sh              # Setup and start script
├── manage.sh             # Service management
├── README.md             # Full documentation
├── analytics/
│   ├── __init__.py
│   ├── sales_analysis.py
│   ├── brand_analysis.py
│   ├── price_comparison.py
│   └── data_cleaning.py
└── venv/                 # Virtual environment (created on first run)
```

## Integration with Node.js

The analytics service is automatically integrated with the Node.js backend. Routes are available at:
- `http://localhost:3000/api/analytics/*`

The Node.js backend acts as a proxy, forwarding requests to the Python service.

