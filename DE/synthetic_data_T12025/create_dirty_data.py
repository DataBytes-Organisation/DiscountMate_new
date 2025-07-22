import pandas as pd
import numpy as np
import random

def add_dirty_data(df, na_prob=0.1, trim_prob=0.5, duplicate_prob=0.1):
    # Make a copy of the original DataFrame to create a dirty version
    df_dirty = df.copy()
    
    # 1. Simulate NA values (set NA/NaN/NaT) for all columns (with a probability of na_prob)
    for col in df_dirty.columns:
        # For object (string) columns, set None for approximately na_prob of the rows
        if df_dirty[col].dtype == 'object':
            mask = np.random.rand(len(df_dirty)) < na_prob
            df_dirty.loc[mask, col] = None
        # For numeric columns, randomly set some values to NaN
        elif np.issubdtype(df_dirty[col].dtype, np.number):
            mask = np.random.rand(len(df_dirty)) < na_prob
            df_dirty.loc[mask, col] = np.nan
        # For datetime columns, set some values to NaT
        elif np.issubdtype(df_dirty[col].dtype, np.datetime64):
            mask = np.random.rand(len(df_dirty)) < na_prob
            df_dirty.loc[mask, col] = pd.NaT

    # 2. Add extra whitespace around string values for object columns (with a probability of trim_prob)
    for col in df_dirty.columns:
        if df_dirty[col].dtype == 'object':
            def add_spaces(val):
                if pd.isna(val):
                    return val
                # With a probability of trim_prob, add whitespace before and after the value
                if random.random() < trim_prob:
                    return " " + str(val) + " "
                return val
            df_dirty[col] = df_dirty[col].apply(add_spaces)
    
    # 3. Duplicate some rows (introduce duplicate records with a probability of duplicate_prob)
    num_duplicates = int(len(df_dirty) * duplicate_prob)
    if num_duplicates > 0:
        duplicates = df_dirty.sample(num_duplicates)
        df_dirty = pd.concat([df_dirty, duplicates], ignore_index=True)
    
    return df_dirty
    
    # 4. Add one redundant column
    if len(df_dirty.columns) > 0:
        col_to_copy = random.choice(df_dirty.columns.tolist())
        df_dirty[f"redundant_{col_to_copy}"] = df_dirty[col_to_copy]

    return df_dirty


# List of original CSV files
files = [
    "users.csv", 
    "stores.csv", 
    "products.csv", 
    "product_pricing.csv", 
    "baskets.csv", 
    "shopping_lists.csv", 
    "shopping_list_items.csv"
]

# Process each file: create a dirty version and save it with a _dirty suffix
for file in files:
    df = pd.read_csv(file)
    df_dirty = add_dirty_data(df)
    dirty_filename = file.replace(".csv", "_dirty.csv")
    df_dirty.to_csv(dirty_filename, index=False)
    print(f"Created dirty data: {dirty_filename}")
