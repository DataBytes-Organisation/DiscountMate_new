import pandas as pd
import numpy as np
import random
import math

# Load the dataset
df = pd.read_csv("Coles_cleaned.csv")

# Prepare brand column from the first word of item_name
df["item_name"] = df["item_name"].fillna("").astype(str).str.strip()
df["Brand"] = df["item_name"].str.split().str[0]
df["category"] = df["category"].fillna("UnknownCategory")

# Define weeks and discount structure
weeks = [f"Week {i+1}" for i in range(8)]
final_rows = []

# Helper to round up to nearest $0.50
def round_up_to_50_cents(x):
    return math.ceil(x * 2) / 2

# Process by category
for category, cat_df in df.groupby("category", sort=False):
    brands = cat_df["Brand"].unique().tolist()
    coles_items = cat_df[cat_df["Brand"].str.lower() == "coles"]
    non_coles_df = cat_df[cat_df["Brand"].str.lower() != "coles"]
    brand_pool = non_coles_df["Brand"].unique().tolist()
    
    prev_50_brand = None

    for week in weeks:
        week_rows = []

        # 1. Select a random brand for 50% off (not same as last week, not Coles)
        eligible_50 = [b for b in brand_pool if b != prev_50_brand]
        brand_50 = random.choice(eligible_50) if eligible_50 else None
        prev_50_brand = brand_50

        # 2. Brands eligible for other tiers (excluding 50% and Coles)
        eligible_brands = [b for b in brand_pool if b != brand_50]
        total_eligible = len(eligible_brands)

        n_30 = max(1, int(0.3 * total_eligible))
        n_10 = max(1, int(0.2 * total_eligible))

        brands_30 = random.sample(eligible_brands, min(n_30, len(eligible_brands)))
        remaining_for_10 = list(set(eligible_brands) - set(brands_30))
        brands_10 = random.sample(remaining_for_10, min(n_10, len(remaining_for_10)))

        # Apply 50% off
        if brand_50:
            brand_50_items = non_coles_df[non_coles_df["Brand"] == brand_50].copy()
            brand_50_items["Week"] = week
            brand_50_items["DiscountRate"] = 0.5
            brand_50_items["IsOnSpecial"] = 1
            brand_50_items["DiscountedPrice"] = brand_50_items["item_price"] * 0.5
            week_rows.append(brand_50_items)

        # Apply 20% or 30% off to brands_30
        for b in brands_30:
            rate = random.choice([0.2, 0.3])
            brand_items = non_coles_df[non_coles_df["Brand"] == b].copy()
            brand_items["Week"] = week
            brand_items["DiscountRate"] = rate
            brand_items["IsOnSpecial"] = 1
            brand_items["DiscountedPrice"] = brand_items["item_price"] * (1 - rate)
            week_rows.append(brand_items)

        # Apply 10% off to brands_10
        for b in brands_10:
            brand_items = non_coles_df[non_coles_df["Brand"] == b].copy()
            brand_items["Week"] = week
            brand_items["DiscountRate"] = 0.1
            brand_items["IsOnSpecial"] = 1
            brand_items["DiscountedPrice"] = brand_items["item_price"] * 0.9
            week_rows.append(brand_items)

        # Apply to Coles: random 30% of items, 20% or 30% discount
        if not coles_items.empty:
            n_coles_discounted = max(1, int(0.3 * len(coles_items)))
            discounted_coles = coles_items.sample(n=n_coles_discounted)
            remaining_coles = coles_items.drop(discounted_coles.index)

            discounted_coles = discounted_coles.copy()
            discounted_coles["Week"] = week
            discounted_coles["DiscountRate"] = [random.choice([0.2, 0.3]) for _ in range(len(discounted_coles))]
            discounted_coles["IsOnSpecial"] = 1
            discounted_coles["DiscountedPrice"] = discounted_coles["item_price"] * (1 - discounted_coles["DiscountRate"])
            week_rows.append(discounted_coles)

            remaining_coles = remaining_coles.copy()
            remaining_coles["Week"] = week
            remaining_coles["DiscountRate"] = 0.0
            remaining_coles["IsOnSpecial"] = 0
            remaining_coles["DiscountedPrice"] = remaining_coles["item_price"]
            week_rows.append(remaining_coles)

        # Now mark all remaining non-discounted items
        discounted_brands = [brand_50] + brands_30 + brands_10
        discounted_set = non_coles_df[non_coles_df["Brand"].isin(discounted_brands)]
        remaining_items = non_coles_df.drop(discounted_set.index, errors='ignore')

        if not remaining_items.empty:
            remaining_items = remaining_items.copy()
            remaining_items["Week"] = week
            remaining_items["DiscountRate"] = 0.0
            remaining_items["IsOnSpecial"] = 0
            remaining_items["DiscountedPrice"] = remaining_items["item_price"]
            week_rows.append(remaining_items)

        # Append all for the week
        final_rows.extend(week_rows)

# Combine and round prices
final_df = pd.concat(final_rows, ignore_index=True)
final_df["DiscountedPrice"] = final_df["DiscountedPrice"].apply(round_up_to_50_cents)

# Sort by Week → Category → item_name
final_df["Week_num"] = final_df["Week"].str.extract(r'(\d+)').astype(int)
final_df.sort_values(by=["Week_num", "category", "item_name"], inplace=True)
final_df.drop(columns=["Week_num"], inplace=True)

# Save to CSV
output_path = "Coles_synthetic_8weeks_v3.csv"
final_df.to_csv(output_path, index=False)
output_path
