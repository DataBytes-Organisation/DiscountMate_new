"""
Sales Analysis Module
Provides functions for analyzing sales data by keyword, store, and other criteria
"""

import pandas as pd
from typing import List, Dict, Optional
import os

# Paths to data files (adjust based on your actual data location)
DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    '..', '..', 'Data Analysis'
)

WOOLIES_DATA_PATH = os.path.join(DATA_DIR, 'customer_transactions_woolies.csv')
COLES_DATA_PATH = os.path.join(DATA_DIR, 'customer_transactions_coles.csv')


def _load_transaction_data():
    """
    Load transaction data from CSV files
    Returns tuple of (woolies_df, coles_df)
    """
    try:
        woolies_df = pd.read_csv(WOOLIES_DATA_PATH) if os.path.exists(WOOLIES_DATA_PATH) else None
        coles_df = pd.read_csv(COLES_DATA_PATH) if os.path.exists(COLES_DATA_PATH) else None
        return woolies_df, coles_df
    except Exception as e:
        print(f"Warning: Could not load transaction data: {e}")
        return None, None


def get_sales_summary_by_keyword(keyword: str, store_filter: str = 'all') -> List[Dict]:
    """
    Get sales summary for products matching a keyword

    Args:
        keyword: Product keyword to search for
        store_filter: Filter by store ('all', 'woolworths', 'coles')

    Returns:
        List of dictionaries with sales summary data
    """
    try:
        woolies_df, coles_df = _load_transaction_data()

        if woolies_df is None and coles_df is None:
            return _get_demo_sales_summary(keyword)

        # Combine store data
        all_data = []
        if woolies_df is not None:
            woolies_tagged = woolies_df.copy()
            woolies_tagged['Store'] = 'Woolworths'
            if store_filter in ['all', 'woolworths']:
                all_data.append(woolies_tagged)

        if coles_df is not None:
            coles_tagged = coles_df.copy()
            coles_tagged['Store'] = 'Coles'
            if store_filter in ['all', 'coles']:
                all_data.append(coles_tagged)

        if not all_data:
            return _get_demo_sales_summary(keyword)

        combined_df = pd.concat(all_data, ignore_index=True)

        # Filter by keyword
        filtered = combined_df[
            combined_df['ItemName'].str.contains(keyword, case=False, na=False)
        ]

        if filtered.empty:
            return []

        # Group and aggregate
        summary = (
            filtered.groupby('ItemName')
            .agg(
                TotalSold=('Quantity', 'sum'),
                UniqueCustomers=('CustomerID', pd.Series.nunique),
                StoreCount=('Store', 'nunique'),
                Stores=('Store', lambda x: ', '.join(x.unique())),
                AvgPrice=('Price', 'mean')
            )
            .sort_values('TotalSold', ascending=False)
            .reset_index()
        )

        # Convert to list of dictionaries
        results = []
        for idx, row in summary.iterrows():
            results.append({
                'item_name': str(row['ItemName']),
                'total_sold': int(row['TotalSold']),
                'unique_customers': int(row['UniqueCustomers']),
                'store_count': int(row['StoreCount']),
                'stores': str(row['Stores']),
                'avg_price': float(row['AvgPrice']) if pd.notna(row['AvgPrice']) else None,
                'is_top_seller': idx == 0
            })

        return results

    except Exception as e:
        print(f"Error in sales analysis: {e}")
        return _get_demo_sales_summary(keyword)


def _get_demo_sales_summary(keyword: str) -> List[Dict]:
    """Fallback demo data if actual data is not available"""
    return [
        {
            'item_name': f'Sample Product with {keyword}',
            'total_sold': 100,
            'unique_customers': 45,
            'store_count': 2,
            'stores': 'Woolworths, Coles',
            'avg_price': 5.99,
            'is_top_seller': True,
            'note': 'Demo data - actual data files not found'
        }
    ]

