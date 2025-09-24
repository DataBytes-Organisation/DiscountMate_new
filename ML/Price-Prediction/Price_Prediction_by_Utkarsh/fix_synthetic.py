import pandas as pd
import numpy as np
import math

# Load dataset
file_path = "Coles_synthetic_8weeks_v3.csv"
df = pd.read_csv(file_path)
print(f"Loaded: {len(df)} rows")

# Track corrections
df["PriceCapped"] = 0

# Cap logic
MAX_PRICE = 100.0
MIN_PRICE = 1.0

# Apply caps
before_cap = df['DiscountedPrice'].copy()
df.loc[df['DiscountedPrice'] > MAX_PRICE, 'DiscountedPrice'] = MAX_PRICE
df.loc[df['DiscountedPrice'] < MIN_PRICE, 'DiscountedPrice'] = MIN_PRICE

# Flag where changes happened
df.loc[df['DiscountedPrice'] != before_cap, 'PriceCapped'] = 1

# Optionally: round up to nearest $0.50 again (after capping)
def round_up_to_50_cents(x):
    return math.ceil(x * 2) / 2

df['DiscountedPrice'] = df['DiscountedPrice'].apply(round_up_to_50_cents)

# Save cleaned version
output_path = "Coles_synthetic_8weeks_v3_cleaned.csv"
df.to_csv(output_path, index=False)

print(f"✅ Cleaned dataset saved to: {output_path}")
print(f"🔎 {df['PriceCapped'].sum()} rows had DiscountedPrice corrected.")
