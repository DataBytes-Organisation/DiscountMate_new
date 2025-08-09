import pandas as pd
import matplotlib.pyplot as plt
from datetime import timedelta

#Load data
df = pd.read_csv('AugmentedData.product_pricing_full_year_5day.csv')
df['date'] = pd.to_datetime(df['date'])
df = df.sort_values('date')

#Most common product
most_common_product = df['product_id'].value_counts().idxmax()
product_df = df[df['product_id'] == most_common_product].copy()

#Visualisation of price trends
plt.figure(figsize=(10, 5))
plt.plot(product_df['date'], product_df['price'], marker='o', linestyle='-', color='blue')
plt.title(f"How the Price Changed Over Time – Product ID: {most_common_product}", fontsize=14)
plt.xlabel("Date", fontsize=12)
plt.ylabel("Price in Dollars ($)", fontsize=12)
plt.grid(True, linestyle='--', alpha=0.5)
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()

#Detect sales
product_df = product_df.sort_values('date')
product_df['price_diff'] = product_df['price'].diff()
sales_df = product_df[product_df['price_diff'] < 0].copy()

#Monthly sale frequency
sales_df['month'] = sales_df['date'].dt.month
monthly_counts = sales_df['month'].value_counts().sort_index()

plt.figure(figsize=(8, 5))
monthly_counts.plot(kind='bar', color='skyblue', edgecolor='black')
plt.title(f"Monthly Sale Frequency – Product ID: {most_common_product}", fontsize=14)
plt.xlabel("Month")
plt.ylabel("Number of Sales")
plt.xticks(ticks=range(0, 12), labels=[
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
], rotation=0)
plt.tight_layout()
plt.show()

#Sales based on the day of the week 
sales_df['weekday'] = sales_df['date'].dt.day_name()
weekday_counts = sales_df['weekday'].value_counts().reindex([
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
])

plt.figure(figsize=(8, 5))
weekday_counts.plot(kind='bar', color='coral', edgecolor='black')
plt.title(f"Sales by Day of the Week – Product ID: {most_common_product}", fontsize=14)
plt.xlabel("Weekday")
plt.ylabel("Number of Sales")
plt.tight_layout()
plt.show()

#Duration of days between sales
sales_df['days_between_sales'] = sales_df['date'].diff().dt.days

plt.figure(figsize=(8, 5))
sales_df['days_between_sales'].dropna().hist(bins=10, edgecolor='black', color='olive')
plt.title(f"Distribution of Days Between Sales – Product ID: {most_common_product}", fontsize=14)
plt.xlabel("Days Between Sales")
plt.ylabel("Frequency")
plt.tight_layout()
plt.show()

#Sales around the end of financial year 
eofy_date = pd.Timestamp("2025-06-30")
sales_df['days_from_eofy'] = (sales_df['date'] - eofy_date).dt.days

plt.figure(figsize=(8, 5))
plt.hist(sales_df['days_from_eofy'], bins=20, edgecolor='black', color='purple')
plt.title(f"Sales Timing Around EOFY (June 30 – Product ID: {most_common_product}", fontsize=14)
plt.xlabel("Days From EOFY")
plt.ylabel("Number of Sales")
plt.tight_layout()
plt.show()

#Monthly sale drop magnitude
sales_df['drop_amount'] = -sales_df['price_diff']

plt.figure(figsize=(10, 6))
sales_df.boxplot(column='drop_amount', by='month', grid=False)
plt.title("Monthly Sale Drop Magnitude")
plt.title(f"Monthly Sale Drop Magnitude – Product ID: {most_common_product}", fontsize=14)
plt.suptitle("")
plt.xlabel("Month")
plt.ylabel("Price Drop Amount")
plt.tight_layout()
plt.show()

# --- Top-3 price trend comparison (non-intrusive) ---
try:
    sr_top3_products = df['product_id'].value_counts().head(3).index.tolist()
    if len(sr_top3_products) > 0:
        plt.figure(figsize=(12, 6))
        for _pid in sr_top3_products:
            _prod = df[df['product_id'] == _pid].copy()
            _prod = _prod.sort_values('date')
            plt.plot(_prod['date'], _prod['price'], marker='o', linestyle='--', label=f'Product {str(_pid)[:6]}')
        plt.title("Price Comparison for Top 3 Products")
        plt.xlabel("Date")
        plt.ylabel("Price ($)")
        plt.legend()
        plt.grid(True, linestyle='--', alpha=0.5)
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.show()
    else:
        print("[Top-3 Trend] Skipped: not enough products.")
except Exception as e:
    print(f"[Top-3 Trend] Skipped due to error: {e}")

# --- Optional: Price Elasticity of Demand (PED) if quantity exists ---
# PED ≈ dln(Q) / dln(P) -> estimated via simple log-log slope per product.
if 'quantity' in df.columns:
    try:
        sr_ped = df[(df['price'] > 0) & (df['quantity'] > 0)].copy()
        sr_ped['log_price'] = np.log(sr_ped['price'])
        sr_ped['log_qty']   = np.log(sr_ped['quantity'])

        def _ped_slope(g):
            x = g['log_price'].values
            y = g['log_qty'].values
            if len(x) < 2 or np.var(x) == 0:
                return np.nan
            # OLS slope for y~x using covariance/variance
            return np.cov(x, y, ddof=0)[0, 1] / np.var(x)

        sr_ped_by_product = (
            sr_ped.groupby('product_id')
                  .apply(_ped_slope)
                  .reset_index(name='ped_slope')
                  .dropna()
        )

        # Interpret: more negative -> more price-sensitive (elastic)
        sr_ped_by_product['interpretation'] = np.where(
            sr_ped_by_product['ped_slope'] <= -1, 'elastic (price-sensitive)',
            np.where(sr_ped_by_product['ped_slope'] < 0, 'inelastic (price-insensitive)', 'no relationship')
        )

        print("\n[PED] Estimated elasticity (dlnQ/dlnP) by product (most elastic first):")
        print(sr_ped_by_product.sort_values('ped_slope').head(10))

        # Quick viz for Top-5 most elastic products
        _top = sr_ped_by_product.sort_values('ped_slope').head(5)
        if not _top.empty:
            plt.figure(figsize=(8, 5))
            plt.barh(_top['product_id'].astype(str).str[:8], _top['ped_slope'])
            plt.title("Most Elastic Products (more negative = more sensitive)")
            plt.xlabel("PED (slope dlnQ/dlnP)")
            plt.grid(axis='x', linestyle='--', alpha=0.5)
            plt.tight_layout()
            plt.show()
    except Exception as e:
        print(f"[PED] Could not compute elasticity: {e}")
else:
    print("[PED] Skipped: 'quantity' column not present in dataset.")