import pandas as pd
import matplotlib.pyplot as plt
from datetime import timedelta
import numpy as np

# Load the data
df = pd.read_csv("AugmentedData.product_pricing.csv")

# Convert date column to datetime
df['date'] = pd.to_datetime(df['date'])

# Sort by date
df = df.sort_values(by='date')

# === PRICE VOLATILITY ANALYSIS ===
# Calculate standard deviation of price for each product
volatility_df = df.groupby('product_id')['price'].std().reset_index().rename(columns={'price': 'price_volatility'})
top_volatile = volatility_df.sort_values(by='price_volatility', ascending=False).head(10)

print("\nTop 10 Most Volatile Products by Price:")
print(top_volatile)

# === SELECT MOST COMMON PRODUCT ===
most_common_product = df['product_id'].value_counts().idxmax()
product_df = df[df['product_id'] == most_common_product]

# === PRICE TREND VISUALIZATION ===
plt.figure(figsize=(10, 5))
plt.plot(product_df['date'], product_df['price'], marker='o', linestyle='-', color='blue')
plt.title(f"How the Price Changed Over Time – Product ID: {most_common_product}", fontsize=14)
plt.xlabel("Date", fontsize=12)
plt.ylabel("Price in Dollars ($)", fontsize=12)
plt.grid(True, linestyle='--', alpha=0.5)
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()

# === SALE DETECTION ===
product_df = product_df.sort_values('date')
product_df['price_diff'] = product_df['price'].diff()
sales_df = product_df[product_df['price_diff'] < 0]

# === NUMBER OF SALES DETECTED ===
num_sales_detected = sales_df.shape[0]
print(f"\nNumber of sales detected for Product {most_common_product}: {num_sales_detected}")

# === TIME BETWEEN SALES ===
sales_df['days_between_sales'] = sales_df['date'].diff().dt.days
avg_days_between_sales = int(sales_df['days_between_sales'].mean())

# === PREDICT NEXT SALE ===
last_sale_date = sales_df['date'].max()
predicted_next_sale = last_sale_date + timedelta(days=avg_days_between_sales)

print(f"Based on past data, this product usually goes on sale every {avg_days_between_sales} days.")
print(f"The last sale was on {last_sale_date.date()}, so the next one might be around {predicted_next_sale.date()}.")

# === SEASONAL SALES PATTERN DETECTION ===
sales_df['month'] = sales_df['date'].dt.month
monthly_sale_counts = sales_df['month'].value_counts().sort_index()

if not monthly_sale_counts.empty:
    plt.figure(figsize=(8, 5))
    monthly_sale_counts.plot(kind='bar', color='skyblue', edgecolor='black')
    plt.title("How Often This Product Goes on Sale Each Month", fontsize=14)
    plt.xlabel("Month of the Year", fontsize=12)
    plt.ylabel("Number of Times Price Dropped", fontsize=12)
    plt.grid(axis='y', linestyle='--', alpha=0.6)
    plt.xticks(ticks=range(0, 12), labels=[
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ], rotation=0)
    plt.tight_layout()
    plt.show()
else:
    print("No sales (price drops) detected for this product — monthly sales frequency plot not generated.")
