"""
Brand Analysis Module
Provides functions for analyzing brand performance and top-selling brands
"""

import pandas as pd
from typing import List, Dict
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


def extract_brand(item_name: str) -> str:
    """
    Extract brand name from item name (first word)

    Args:
        item_name: Full product item name

    Returns:
        Brand name (first word) or None
    """
    if not isinstance(item_name, str) or not item_name.strip():
        return None
    return item_name.split()[0]


def get_top_brands_by_keyword(keyword: str, top_n: int = 5) -> List[Dict]:
    """
    Get top-selling brands for products matching a keyword

    Args:
        keyword: Product keyword to search for
        top_n: Number of top brands to return

    Returns:
        List of dictionaries with brand analysis data
    """
    try:
        woolies_df, coles_df = _load_transaction_data()

        if woolies_df is None and coles_df is None:
            return _get_demo_brand_analysis(keyword, top_n)

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
            return _get_demo_brand_analysis(keyword, top_n)

        combined_df = pd.concat(all_data, ignore_index=True)

        # Extract brand
        combined_df['Brand'] = combined_df['ItemName'].apply(extract_brand)

        # Filter by keyword
        filtered_df = combined_df[
            combined_df['ItemName'].str.contains(keyword, case=False, na=False)
        ]

        if filtered_df.empty:
            return []

        # Group by Store and Brand, sum quantities
        grouped = (
            filtered_df.groupby(['Store', 'Brand'])['Quantity']
            .sum()
            .reset_index()
            .sort_values('Quantity', ascending=False)
        )

        # Get top brand per store
        top_brands_per_store = grouped.groupby('Store').head(1)

        # Get overall top brands
        overall_top = (
            filtered_df.groupby('Brand')['Quantity']
            .sum()
            .reset_index()
            .sort_values('Quantity', ascending=False)
            .head(top_n)
        )

        # Combine results
        results = []

        # Add top brand per store
        for _, row in top_brands_per_store.iterrows():
            results.append({
                'brand': str(row['Brand']),
                'store': str(row['Store']),
                'total_quantity': int(row['Quantity']),
                'is_top_in_store': True
            })

        # Add overall top brands
        for _, row in overall_top.iterrows():
            brand = str(row['Brand'])
            # Avoid duplicates
            if not any(r['brand'] == brand and r.get('is_top_in_store') for r in results):
                results.append({
                    'brand': brand,
                    'store': 'All',
                    'total_quantity': int(row['Quantity']),
                    'is_top_in_store': False
                })

        return results[:top_n]

    except Exception as e:
        print(f"Error in brand analysis: {e}")
        return _get_demo_brand_analysis(keyword, top_n)


def _get_demo_brand_analysis(keyword: str, top_n: int) -> List[Dict]:
    """Fallback demo data if actual data is not available"""
    return [
        {
            'brand': 'SampleBrand',
            'store': 'Woolworths',
            'total_quantity': 500,
            'is_top_in_store': True,
            'note': 'Demo data - actual data files not found'
        },
        {
            'brand': 'AnotherBrand',
            'store': 'Coles',
            'total_quantity': 450,
            'is_top_in_store': True,
            'note': 'Demo data - actual data files not found'
        }
    ]

