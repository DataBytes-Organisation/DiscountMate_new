import pandas as pd

# Function to clean web-scraped data
def clean_web_scraped_data(data, file_type):
    # Standardize column names
    data.columns = data.columns.str.strip().str.lower().str.replace(' ', '_')
    
    # Remove duplicates
    data = data.drop_duplicates()
    
    # Remove rows based on category column for each file type
    if 'category' in data.columns:
        if file_type == 'Coles':
            data = data[data['category'] != "Bonus Ovenware Credits"]
        elif file_type == 'Woolworths':
            data = data[~data['category'].isin(["Electronics", "Home & Lifestyle"])]
    
    # Convert price-related columns to numeric
    for col in ['best_price', 'item_price', 'price_was', 'best_unit_price', 'unit_price']:
        if col in data.columns:
            data[col] = data[col].str.replace(r'[^\d.]', '', regex=True).astype(float)
    
    # Handle missing values
    threshold = len(data) * 0.5
    data = data.dropna(axis=1, thresh=threshold)  # Drop columns with >50% missing
    data = data.dropna()  # Drop rows with any remaining missing values
    
    return data

# Load and clean Coles dataset
coles_file_path = 'Coles.csv'
coles_data = pd.read_csv(coles_file_path)
cleaned_coles_data = clean_web_scraped_data(coles_data, 'Coles')

# Save the cleaned Coles dataset
coles_output_file_path = 'Coles_cleaned.csv'
cleaned_coles_data.to_csv(coles_output_file_path, index=False)
print(f"Cleaned Coles data saved to {coles_output_file_path}")

# Load and clean Woolworths dataset
woolworths_file_path = 'Woolworths.csv'
woolworths_data = pd.read_csv(woolworths_file_path)
cleaned_woolworths_data = clean_web_scraped_data(woolworths_data, 'Woolworths')

# Save the cleaned Woolworths dataset
woolworths_output_file_path = 'Woolworths_cleaned.csv'
cleaned_woolworths_data.to_csv(woolworths_output_file_path, index=False)
print(f"Cleaned Woolworths data saved to {woolworths_output_file_path}")
