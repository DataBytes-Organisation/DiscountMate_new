# File performs two functions:
# 1) Cleans Blank Item Name fields based on link field details.
# 2) Maps original Category fields into revised categories based on mapping file.

import pandas as pd
import re
import logging
import os

# Input file path and output file paths
base_dir = os.path.dirname(__file__)
input_path = os.path.join(base_dir, "Most_recent_data.csv")          # original input file - Most recent data
#input_path = os.path.join(base_dir, "All_scraped_products.csv")      # original input file - All scrapped products
mapping_path = os.path.join(base_dir, "category_mapping.csv")        # two columns: original, revised
output_path = os.path.join(base_dir, "Most_recent_data_cleaned.csv")   # output file - Most recent data cleaned
#output_path = os.path.join(base_dir, "All_scraped_products_cleaned.csv")   # output file - All scrapped products cleaned
log_path = os.path.join(base_dir, "Log_File_data_updates.log")                # logger file in same folder

# Configure logger
logging.basicConfig(
    filename=log_path,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create dataframes
df = pd.read_csv(input_path)
mapping_df = pd.read_csv(mapping_path)

# Build dictionary between original and revised categories
category_map = dict(zip(mapping_df.iloc[:, 0], mapping_df.iloc[:, 1]))

# Initialize empty lists to track changes
item_changes = []
category_changes = []

# Item name cleaning function
def clean_item_name(link, promo_text=None):
    """
    Rules:
    - If link starts with https://www.igashop.com.au/product/...:
      extract segment after 4th '/', drop trailing '-<digits>', replace '-' with space, title-case.
    - If link starts with https://www.iga.com.au/catalogue/...:
      use promo_text if present.
    - Else: return blank string.
    """
    try:
        if isinstance(link, str) and link.startswith("https://www.igashop.com.au/product/"):
            # Extract product part after the 4th '/'
            parts = link.split('/')
            if len(parts) > 4:
                product_part = parts[4]
            else:
                return ""
            # Remove trailing numeric characters after the last '-'
            product_part = re.sub(r'-\d+$', '', product_part)
            # Replace '-' with spaces and capitalize
            return product_part.replace('-', ' ').title()

        elif isinstance(link, str) and link.startswith("https://www.iga.com.au/catalogue/"):
            return promo_text if (isinstance(promo_text, str) and promo_text.strip() != "") else ""

        else:
            return ""
    except Exception as e:
        logger.error(f"Error cleaning link '{link}': {e}")
        return ""

#  Row update function for item_name
def update_item_name(row):
    current = row.get('item_name')
    if pd.isna(current) or str(current).strip() == '':
        cleaned = clean_item_name(row.get('link'), row.get('promo_text'))
        if cleaned:
            item_changes.append((row.get('link'), cleaned))
            logger.info(f"Item updated: Link='{row.get('link')}' -> Item Name='{cleaned}'")
            print(f"Item updated: Link='{row.get('link')}' -> Item Name='{cleaned}'")
            return cleaned
    return current

# Apply item_name updates to the original data
df['item_name'] = df.apply(update_item_name, axis=1)

# Category mapping Function
def map_category(original_category):
    revised = category_map.get(original_category, None)
    if revised:
        if revised != original_category:
            category_changes.append((original_category, revised))
            logger.info(f"Category updated: '{original_category}' -> '{revised}'")
            print(f"Category updated: '{original_category}' -> '{revised}'")
        return revised
    else:
        logger.warning(f"No mapping found for category: '{original_category}'")
        print(f"No mapping found for category: '{original_category}'")
        return ""

# Apply mapping on the original category column to produce revised_category
df['revised_category'] = df['category'].apply(map_category)

# Save to csv file
df.to_csv(output_path, index=False)

# Print Summary of changes
print(f"\nTotal item_name changes made: {len(item_changes)}")
print(f"Total category changes made: {len(category_changes)}")

freq_table = df['revised_category'].value_counts().sort_index()
print("\nFrequency of items per revised category:")
print(freq_table)

logger.info(f"Total item_name changes: {len(item_changes)}")
logger.info(f"Total category changes: {len(category_changes)}")
logger.info("Frequency of items per revised category:\n" + freq_table.to_string())
