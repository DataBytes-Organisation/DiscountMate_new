"""
Data Cleaning Module
Provides functions for cleaning and preprocessing transaction data
"""

import pandas as pd
from typing import List, Dict, Optional
import numpy as np


def clean_transaction_data(transactions: List[Dict], operations: List[str] = None) -> List[Dict]:
    """
    Clean and preprocess transaction data

    Args:
        transactions: List of transaction dictionaries
        operations: List of cleaning operations to apply:
            - 'remove_duplicates': Remove duplicate transactions
            - 'handle_missing': Handle missing values
            - 'standardize': Standardize data formats
            - 'validate_types': Validate and convert data types

    Returns:
        List of cleaned transaction dictionaries
    """
    if not transactions:
        return []

    if operations is None:
        operations = ['remove_duplicates', 'handle_missing', 'standardize']

    # Convert to DataFrame for easier processing
    df = pd.DataFrame(transactions)

    # Apply cleaning operations
    if 'remove_duplicates' in operations:
        df = _remove_duplicates(df)

    if 'handle_missing' in operations:
        df = _handle_missing_values(df)

    if 'standardize' in operations:
        df = _standardize_formats(df)

    if 'validate_types' in operations:
        df = _validate_types(df)

    # Convert back to list of dictionaries
    return df.to_dict('records')


def _remove_duplicates(df: pd.DataFrame) -> pd.DataFrame:
    """Remove duplicate rows"""
    return df.drop_duplicates()


def _handle_missing_values(df: pd.DataFrame) -> pd.DataFrame:
    """Handle missing values in the dataframe"""
    df_cleaned = df.copy()

    # For numeric columns, fill with median
    numeric_cols = df_cleaned.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        if df_cleaned[col].isna().any():
            df_cleaned[col].fillna(df_cleaned[col].median(), inplace=True)

    # For categorical columns, fill with mode
    categorical_cols = df_cleaned.select_dtypes(include=['object']).columns
    for col in categorical_cols:
        if df_cleaned[col].isna().any():
            mode_value = df_cleaned[col].mode()
            if not mode_value.empty:
                df_cleaned[col].fillna(mode_value[0], inplace=True)
            else:
                df_cleaned[col].fillna('Unknown', inplace=True)

    return df_cleaned


def _standardize_formats(df: pd.DataFrame) -> pd.DataFrame:
    """Standardize data formats"""
    df_cleaned = df.copy()

    # Standardize string columns (trim whitespace, title case)
    string_cols = df_cleaned.select_dtypes(include=['object']).columns
    for col in string_cols:
        if df_cleaned[col].dtype == 'object':
            df_cleaned[col] = df_cleaned[col].astype(str).str.strip()

    # Standardize price columns (remove $, convert to float)
    price_cols = [col for col in df_cleaned.columns if 'price' in col.lower() or 'cost' in col.lower()]
    for col in price_cols:
        if df_cleaned[col].dtype == 'object':
            df_cleaned[col] = df_cleaned[col].str.replace('$', '').str.replace(',', '').astype(float, errors='ignore')

    return df_cleaned


def _validate_types(df: pd.DataFrame) -> pd.DataFrame:
    """Validate and convert data types"""
    df_cleaned = df.copy()

    # Common column name patterns and their expected types
    type_mapping = {
        'id': 'int64',
        'quantity': 'int64',
        'price': 'float64',
        'date': 'datetime64',
        'customer': 'int64',
        'product': 'int64'
    }

    for col in df_cleaned.columns:
        col_lower = col.lower()
        for pattern, dtype in type_mapping.items():
            if pattern in col_lower:
                try:
                    if dtype == 'datetime64':
                        df_cleaned[col] = pd.to_datetime(df_cleaned[col], errors='coerce')
                    else:
                        df_cleaned[col] = df_cleaned[col].astype(dtype, errors='ignore')
                except Exception:
                    pass  # Skip if conversion fails
                break

    return df_cleaned

