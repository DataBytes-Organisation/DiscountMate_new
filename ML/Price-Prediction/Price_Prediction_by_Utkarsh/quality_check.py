import pandas as pd
import math

# Load your synthetic dataset
file_path = "Coles_synthetic_8weeks_v3_cleaned.csv"  # Update if needed

# Load data
try:
    df = pd.read_csv(file_path)
    print(f"✅ Successfully loaded dataset with {len(df)} rows.")
except Exception as e:
    raise ValueError(f"❌ Failed to load dataset: {e}")

# Helper function to round up to nearest $0.50
def round_up_to_50_cents(x):
    return math.ceil(x * 2) / 2

pass_checks = True

print("\n--- Basic Checks ---")

# 1. Check missing values
missing = df.isnull().sum()
if missing.any():
    print("❌ Missing values detected:")
    print(missing[missing > 0])
    pass_checks = False
else:
    print("✅ No missing values.")

# 2. Unique Weeks Check
weeks = df['Week'].unique()
if sorted(weeks) == [f"Week {i+1}" for i in range(8)]:
    print("✅ All 8 weeks are present.")
else:
    print(f"❌ Week mismatch detected: {weeks}")
    pass_checks = False

# 3. Row Count Check (fixed to count unique product-week combinations)
unique_per_week = df.groupby('Week')['product_code'].nunique()
expected_products = df['product_code'].nunique()
row_issues = unique_per_week[unique_per_week != expected_products]
if row_issues.empty:
    print("✅ Each product appears exactly once per week.")
else:
    print("❌ Some products appear more than once or are missing in certain weeks:")
    print(row_issues)
    pass_checks = False

print("\n--- Discount Logic Checks ---")

# 4. Coles Brand Discount Check
coles_df = df[df['Brand'].str.lower() == 'coles']
if (coles_df['DiscountRate'] == 0.5).any():
    print("❌ Coles brand has 50% discount, which should not happen.")
    pass_checks = False
else:
    print("✅ Coles brand has only 20%, 30%, or 0% discounts.")

# 5. 50% Brand Uniqueness Check (excluding Coles)
df_50 = df[(df['DiscountRate'] == 0.5) & (df['Brand'].str.lower() != 'coles')]
check_50 = df_50.groupby(['Week', 'category'])['Brand'].nunique()
if (check_50 > 1).any():
    print("❌ More than one brand has 50% discount in a (Week, Category).")
    pass_checks = False
else:
    print("✅ Only one brand per category per week has 50% discount.")

print("\n--- Price Check ---")

# 6. Discounted Price Check (sample 5 rows)
sample = df[df['IsOnSpecial'] == 1].sample(5, random_state=42)
price_mismatches = 0
for idx, row in sample.iterrows():
    expected_price = round_up_to_50_cents(row['item_price'] * (1 - row['DiscountRate']))
    if not math.isclose(expected_price, row['DiscountedPrice'], rel_tol=1e-2):
        print(f"❌ Price mismatch for {row['item_name']} - Expected: {expected_price}, Got: {row['DiscountedPrice']}")
        price_mismatches += 1
if price_mismatches == 0:
    print("✅ All sampled discounted prices match.")
else:
    pass_checks = False

print("\n--- Weekly Special Distribution ---")

# 7. Specials distribution per week
specials_per_week = df.groupby('Week')['IsOnSpecial'].mean() * 100
print(specials_per_week)

# Final summary
print("\n==============================")
if pass_checks:
    print("✅✅✅ Dataset PASSES all quality checks! Ready to use.")
else:
    print("❌❌❌ Dataset FAILED some quality checks. Review the issues above.")
print("==============================")
