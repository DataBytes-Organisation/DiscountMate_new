"""
Price Comparison Module
Provides functions for comparing prices across stores
"""

import pandas as pd
from typing import List, Dict, Optional
import os

# Paths to data files
DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    '..', '..', 'Data Analysis'
)

WOOLIES_DATA_PATH = os.path.join(DATA_DIR, 'customer_transactions_woolies.csv')
COLES_DATA_PATH = os.path.join(DATA_DIR, 'customer_transactions_coles.csv')


def _load_transaction_data():
    """Load transaction data from CSV files"""
    try:
        woolies_df = pd.read_csv(WOOLIES_DATA_PATH) if os.path.exists(WOOLIES_DATA_PATH) else None
        coles_df = pd.read_csv(COLES_DATA_PATH) if os.path.exists(COLES_DATA_PATH) else None
        return woolies_df, coles_df
    except Exception as e:
        print(f"Warning: Could not load transaction data: {e}")
        return None, None


def compare_prices_by_keyword(keyword: str, include_details: bool = False) -> Dict:
    """
    Compare prices across stores for products matching a keyword

    Args:
        keyword: Product keyword to search for
        include_details: Whether to include full product details

    Returns:
        Dictionary with price comparison data
    """
    try:
        woolies_df, coles_df = _load_transaction_data()

        if woolies_df is None and coles_df is None:
            return _get_demo_price_comparison(keyword)

        # Combine store data
        all_data = []
        if woolies_df is not None:
            woolies_tagged = woolies_df.copy()
            woolies_tagged['Store'] = 'Woolworths'
            all_data.append(woolies_tagged)

        if coles_df is not None:
            coles_tagged = coles_df.copy()
            coles_tagged['Store'] = 'Coles'
            all_data.append(coles_tagged)

        if not all_data:
            return _get_demo_price_comparison(keyword)

        combined_df = pd.concat(all_data, ignore_index=True)

        # Filter by keyword
        filtered = combined_df[
            combined_df['ItemName'].str.contains(keyword, case=False, na=False)
        ]

        if filtered.empty:
            return {
                'keyword': keyword,
                'products_found': 0,
                'stores': {},
                'cheapest_overall': None
            }

        # Find cheapest per store
        cheapest_per_store = {}
        stores = filtered['Store'].unique()

        for store in stores:
            store_data = filtered[filtered['Store'] == store]
            if 'Price' in store_data.columns:
                cheapest_idx = store_data['Price'].idxmin()
                cheapest = store_data.loc[cheapest_idx]
                cheapest_per_store[store] = {
                    'item_name': str(cheapest['ItemName']),
                    'price': float(cheapest['Price']) if pd.notna(cheapest['Price']) else None,
                    'quantity': int(cheapest['Quantity']) if 'Quantity' in cheapest else None
                }

                if include_details:
                    cheapest_per_store[store]['details'] = cheapest.to_dict()

        # Find cheapest overall
        if 'Price' in filtered.columns:
            overall_cheapest_idx = filtered['Price'].idxmin()
            overall_cheapest = filtered.loc[overall_cheapest_idx]
            cheapest_overall = {
                'item_name': str(overall_cheapest['ItemName']),
                'store': str(overall_cheapest['Store']),
                'price': float(overall_cheapest['Price']) if pd.notna(overall_cheapest['Price']) else None
            }
        else:
            cheapest_overall = None

        return {
            'keyword': keyword,
            'products_found': len(filtered),
            'stores': cheapest_per_store,
            'cheapest_overall': cheapest_overall,
            'price_difference': _calculate_price_difference(cheapest_per_store) if len(cheapest_per_store) > 1 else None
        }

    except Exception as e:
        print(f"Error in price comparison: {e}")
        return _get_demo_price_comparison(keyword)


def _calculate_price_difference(cheapest_per_store: Dict) -> Optional[Dict]:
    """Calculate price difference between stores"""
    prices = {store: data['price'] for store, data in cheapest_per_store.items() if data.get('price') is not None}

    if len(prices) < 2:
        return None

    sorted_prices = sorted(prices.items(), key=lambda x: x[1])
    cheapest_store, cheapest_price = sorted_prices[0]
    expensive_store, expensive_price = sorted_prices[-1]

    return {
        'cheapest_store': cheapest_store,
        'cheapest_price': cheapest_price,
        'expensive_store': expensive_store,
        'expensive_price': expensive_price,
        'difference': expensive_price - cheapest_price,
        'savings_percentage': ((expensive_price - cheapest_price) / expensive_price * 100) if expensive_price > 0 else 0
    }


def _get_demo_price_comparison(keyword: str) -> Dict:
    """Fallback demo data if actual data is not available"""
    return {
        'keyword': keyword,
        'products_found': 0,
        'stores': {
            'Woolworths': {
                'item_name': f'Sample {keyword} Product',
                'price': 4.99,
                'note': 'Demo data'
            },
            'Coles': {
                'item_name': f'Sample {keyword} Product',
                'price': 5.49,
                'note': 'Demo data'
            }
        },
        'cheapest_overall': {
            'item_name': f'Sample {keyword} Product',
            'store': 'Woolworths',
            'price': 4.99
        },
        'note': 'Demo data - actual data files not found'
    }

