"""
Temporary synthetic price history data for DA-03-T5 (historical context scoring).

This is a placeholder dataset used because the real Gold Layer historical
price data is not yet available (confirmed with Data Engineering — expected
next trimester). Once the Gold Layer is ready, this synthetic lookup should
be replaced with a real query against historical price records.
"""

SYNTHETIC_PRICE_HISTORY = {
    # Rarely discounts - staple item, one genuine rare drop
    "Woolworths Full Cream Milk 2L": [3.00, 3.00, 3.00, 3.00, 3.00, 2.00, 3.00, 3.00],

    # Frequently discounts - confectionery on a regular promo cycle
    "Cadbury Dairy Milk Chocolate Bar 50g": [3.50, 2.00, 3.50, 2.00, 3.50, 2.00, 3.50, 2.00],

    # Moderate discounter - occasional promos
    "Woolworths Cherry Tomatoes Punnet 250g": [3.20, 3.20, 2.80, 3.20, 3.20, 2.50, 3.20, 3.20],

    # Stable, never discounts
    "Woolworths Cavendish Bananas Each": [0.81, 0.81, 0.81, 0.81, 0.81, 0.81, 0.81, 0.81],
}


def get_price_history(product_name: str):
    """
    Look up synthetic price history for a product by name.
    Returns None if no history is available (e.g. new/unseen product).
    """
    return SYNTHETIC_PRICE_HISTORY.get(product_name)
