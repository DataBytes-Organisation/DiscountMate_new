import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("TkAgg")  # Or "Qt5Agg"
import matplotlib.pyplot as plt


from datetime import timedelta
import os

# --- Load and Prepare Data ---
df = pd.read_csv('AugmentedData.product_pricing_full_year_5day.csv')
df['date'] = pd.to_datetime(df['date'])
df = df.sort_values('date')

# --- Price Volatility Analysis ---
volatility_df = df.groupby('product_id')['price'].std().reset_index(name='price_volatility')
top_volatile = volatility_df.sort_values(by='price_volatility', ascending=False).head(10)
print("\nTop 10 Most Volatile Products by Price:")
print(top_volatile)

# --- Select Most Common Product for Detailed Analysis ---
most_common_product = df['product_id'].value_counts().idxmax()
product_df = df[df['product_id'] == most_common_product].copy()
product_df = product_df.sort_values('date')

# --- Price Trend Visualization ---
plt.figure(figsize=(10, 5))
plt.plot(product_df['date'], product_df['price'], marker='o', linestyle='-', color='blue')
plt.title(f"Price Trend Over Time – Product ID: {most_common_product}", fontsize=14)
plt.xlabel("Date")
plt.ylabel("Price ($)")
plt.grid(True, linestyle='--', alpha=0.5)
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()

# --- Sales Detection: Identify Price Drops ---
product_df['price_diff'] = product_df['price'].diff()
sales_df = product_df[product_df['price_diff'] < 0].copy()
num_sales_detected = sales_df.shape[0]
print(f"\nNumber of sales detected for Product {most_common_product}: {num_sales_detected}")

# --- Time Between Sales and Next Sale Prediction ---
sales_df['days_between_sales'] = sales_df['date'].diff().dt.days
avg_days_between_sales = int(sales_df['days_between_sales'].mean())
last_sale_date = sales_df['date'].max()
predicted_next_sale = last_sale_date + timedelta(days=avg_days_between_sales)

print(f"Average interval between sales: {avg_days_between_sales} days")
print(f"Last sale date: {last_sale_date.date()}")
print(f"Predicted next sale date: {predicted_next_sale.date()}")

# --- Seasonal Sales Pattern: Monthly Frequency ---
sales_df['month'] = sales_df['date'].dt.month
monthly_counts = sales_df['month'].value_counts().sort_index()

if not monthly_counts.empty:
    plt.figure(figsize=(8, 5))
    monthly_counts.plot(kind='bar', color='skyblue', edgecolor='black')
    plt.title(f"Monthly Sales Frequency – Product ID: {most_common_product}")
    plt.xlabel("Month")
    plt.ylabel("Number of Sales")
    plt.xticks(ticks=range(1,13), labels=[
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ], rotation=0)
    plt.grid(axis='y', linestyle='--', alpha=0.6)
    plt.tight_layout()
    plt.show()
else:
    print("No sales detected for monthly frequency plot.")

# --- Sales by Weekday ---
sales_df['weekday'] = sales_df['date'].dt.day_name()
weekday_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
weekday_counts = sales_df['weekday'].value_counts().reindex(weekday_order).fillna(0)

plt.figure(figsize=(8, 5))
weekday_counts.plot(kind='bar', color='coral', edgecolor='black')
plt.title(f"Sales by Day of the Week – Product ID: {most_common_product}")
plt.xlabel("Weekday")
plt.ylabel("Number of Sales")
plt.tight_layout()
plt.show()

# --- Distribution of Days Between Sales ---
plt.figure(figsize=(8, 5))
sales_df['days_between_sales'].dropna().hist(bins=10, edgecolor='black', color='olive')
plt.title(f"Distribution of Days Between Sales – Product ID: {most_common_product}")
plt.xlabel("Days Between Sales")
plt.ylabel("Frequency")
plt.tight_layout()
plt.show()

# --- Sales Timing Around EOFY (June 30, 2025) ---
eofy_date = pd.Timestamp("2025-06-30")
sales_df['days_from_eofy'] = (sales_df['date'] - eofy_date).dt.days

plt.figure(figsize=(8, 5))
plt.hist(sales_df['days_from_eofy'], bins=20, edgecolor='black', color='purple')
plt.title(f"Sales Timing Around EOFY – Product ID: {most_common_product}")
plt.xlabel("Days From EOFY")
plt.ylabel("Number of Sales")
plt.tight_layout()
plt.show()

# --- Monthly Sale Drop Magnitude Boxplot ---
sales_df['drop_amount'] = -sales_df['price_diff']

plt.figure(figsize=(10, 6))
sales_df.boxplot(column='drop_amount', by='month', grid=False)
plt.title(f"Monthly Sale Drop Magnitude – Product ID: {most_common_product}")
plt.suptitle("")
plt.xlabel("Month")
plt.ylabel("Price Drop Amount")
plt.tight_layout()
plt.show()

# --- Top 3 Products Price Trend Comparison ---
top3_products = df['product_id'].value_counts().head(3).index.tolist()

if top3_products:
    plt.figure(figsize=(12, 6))
    for pid in top3_products:
        prod_data = df[df['product_id'] == pid].sort_values('date')
        plt.plot(prod_data['date'], prod_data['price'], marker='o', linestyle='--', label=f'Product {str(pid)[:6]}')
    plt.title("Price Comparison for Top 3 Products")
    plt.xlabel("Date")
    plt.ylabel("Price ($)")
    plt.legend()
    plt.grid(True, linestyle='--', alpha=0.5)
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.show()
else:
    print("Top-3 trend plot skipped: Not enough products.")

# --- Optional: Price Elasticity of Demand (PED) ---
if 'quantity' in df.columns:
    try:
        ped_df = df[(df['price'] > 0) & (df['quantity'] > 0)].copy()
        ped_df['log_price'] = np.log(ped_df['price'])
        ped_df['log_qty'] = np.log(ped_df['quantity'])

        def ped_slope(group):
            x = group['log_price'].values
            y = group['log_qty'].values
            if len(x) < 2 or np.var(x) == 0:
                return np.nan
            return np.cov(x, y, ddof=0)[0, 1] / np.var(x)

        ped_results = ped_df.groupby('product_id').apply(ped_slope).reset_index(name='ped_slope').dropna()

        ped_results['interpretation'] = np.where(
            ped_results['ped_slope'] <= -1, 'elastic (price-sensitive)',
            np.where(ped_results['ped_slope'] < 0, 'inelastic (price-insensitive)', 'no relationship')
        )

        print("\n[PED] Estimated Elasticity (dlnQ/dlnP) by Product (most elastic first):")
        print(ped_results.sort_values('ped_slope').head(10))

        top_elastic = ped_results.sort_values('ped_slope').head(5)
        if not top_elastic.empty:
            plt.figure(figsize=(8, 5))
            plt.barh(top_elastic['product_id'].astype(str).str[:8], top_elastic['ped_slope'])
            plt.title("Top 5 Most Elastic Products (more negative = more sensitive)")
            plt.xlabel("PED (Slope dlnQ/dlnP)")
            plt.grid(axis='x', linestyle='--', alpha=0.5)
            plt.tight_layout()
            plt.show()
    except Exception as e:
        print(f"[PED] Could not compute elasticity: {e}")
else:
    print("[PED] Skipped: 'quantity' column not present in dataset.")


# =========================
# 0) Config
# =========================
FILE_PATH = r"AugmentedData.product_pricing_full_year_5day.csv"
OUTPUT_DIR = os.path.join(os.path.dirname(FILE_PATH), "outlier_full_year_results")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Choose method: "iqr", "zscore", or "both"
OUTLIER_METHOD = "both"       # robust default
IQR_K = 1.5                   # 1.5 (moderate) or 3.0 (strict)
ZSCORE_THRESHOLD = 3.0        # classic z-score cut


# =========================
# 1) Load and clean
# =========================
def load_data(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df = df.rename(columns={
        "_id": "_id",
        "product_id": "product_id",
        "date": "date",
        "price": "price"
    })
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["price"] = pd.to_numeric(df["price"].astype(str).str.replace("$", "", regex=False), errors="coerce")
    df = df.dropna(subset=["product_id", "date", "price"])
    df = df[df["price"] > 0]
    df = df.sort_values(["product_id", "date"]).reset_index(drop=True)
    df["day"] = df["date"].dt.date
    return df

df = load_data(FILE_PATH)
print(f"Records: {len(df)} | Products: {df['product_id'].nunique()} | "
      f"Date range: {df['date'].min()} → {df['date'].max()}")


# =========================
# 2) Per-product static stats
# =========================
def compute_product_stats(g: pd.DataFrame) -> pd.Series:
    median_price = g["price"].median()
    mean_price   = g["price"].mean()
    std_price    = g["price"].std(ddof=1)
    q1, q3       = g["price"].quantile([0.25, 0.75])
    iqr          = q3 - q1
    mad          = np.median(np.abs(g["price"] - median_price))
    min_price    = g["price"].min()
    max_price    = g["price"].max()
    return pd.Series({
        "n_points": len(g),
        "mean_price": mean_price,
        "median_price": median_price,
        "std_price": std_price if np.isfinite(std_price) else np.nan,
        "q1": q1,
        "q3": q3,
        "iqr": iqr,
        "mad": mad,
        "min_price": min_price,
        "max_price": max_price
    })

product_stats = df.groupby("product_id").apply(compute_product_stats).reset_index()
product_stats.to_csv(os.path.join(OUTPUT_DIR, "per_product_stats.csv"), index=False)
print(f"Saved per-product stats → {os.path.join(OUTPUT_DIR, 'per_product_stats.csv')}")


# =========================
# 3) Outlier detection (static baseline)
# =========================
def detect_outliers(df: pd.DataFrame,
                    stats: pd.DataFrame,
                    method: str = "iqr",
                    iqr_k: float = 1.5,
                    z_thresh: float = 3.0) -> pd.DataFrame:
    stats_map = stats.set_index("product_id").to_dict(orient="index")

    out = df.copy()
    # Attach static baselines and extrema
    out["median_price"] = out["product_id"].map(lambda pid: stats_map[pid]["median_price"])
    out["mean_price"]   = out["product_id"].map(lambda pid: stats_map[pid]["mean_price"])
    out["std_price"]    = out["product_id"].map(lambda pid: stats_map[pid]["std_price"])
    out["q1"]           = out["product_id"].map(lambda pid: stats_map[pid]["q1"])
    out["q3"]           = out["product_id"].map(lambda pid: stats_map[pid]["q3"])
    out["iqr"]          = out["product_id"].map(lambda pid: stats_map[pid]["iqr"])
    out["min_price"]    = out["product_id"].map(lambda pid: stats_map[pid]["min_price"])
    out["max_price"]    = out["product_id"].map(lambda pid: stats_map[pid]["max_price"])

    # Boundaries for IQR
    out["iqr_lower"] = out["q1"] - iqr_k * out["iqr"]
    out["iqr_upper"] = out["q3"] + iqr_k * out["iqr"]

    # Z-score (used for method "zscore" or "both")
    out["z_score"] = (out["price"] - out["mean_price"]) / out["std_price"]
    out.loc[~np.isfinite(out["z_score"]), "z_score"] = np.nan

    # Flags
    iqr_flag = (out["price"] < out["iqr_lower"]) | (out["price"] > out["iqr_upper"])
    z_flag   = out["z_score"].abs() > z_thresh

    if method == "iqr":
        out["is_outlier"] = iqr_flag
        out["outlier_method"] = "iqr"
    elif method == "zscore":
        out["is_outlier"] = z_flag
        out["outlier_method"] = "zscore"
    else:  # both
        out["is_outlier"] = iqr_flag | z_flag
        out["outlier_method"] = np.where(iqr_flag & z_flag, "both",
                                  np.where(iqr_flag, "iqr", np.where(z_flag, "zscore", "")))
    return out

flagged = detect_outliers(df, product_stats, method=OUTLIER_METHOD, iqr_k=IQR_K, z_thresh=ZSCORE_THRESHOLD)

outliers = flagged[flagged["is_outlier"]].copy()
out_cols = [
    "_id", "product_id", "date", "day", "price",
    "median_price", "mean_price", "min_price", "max_price",
    "q1", "q3", "iqr", "iqr_lower", "iqr_upper",
    "z_score", "outlier_method"
]
outliers = outliers[out_cols].sort_values(["product_id", "date"])
outliers_path = os.path.join(OUTPUT_DIR, "outliers_static_baseline.csv")
outliers.to_csv(outliers_path, index=False)
print(f"Saved outliers → {outliers_path} (rows: {len(outliers)})")


# =========================
# 4) “Hot dates” analysis (outlier counts only)
# =========================
hot_outlier = (outliers.groupby("day")["product_id"]
               .nunique()
               .reset_index(name="num_products_outlier"))
hot_outlier["share_of_all_products"] = hot_outlier["num_products_outlier"] / df["product_id"].nunique()
hot_outlier = hot_outlier.sort_values("num_products_outlier", ascending=False)
hot_outlier_path = os.path.join(OUTPUT_DIR, "hot_dates_outliers.csv")
hot_outlier.to_csv(hot_outlier_path, index=False)
print(f"Saved hot dates (outliers) → {hot_outlier_path}")


# =========================
# 5) Per-product plots
# =========================
def plot_product_static_baseline(product_id: str):
    g = flagged[flagged["product_id"] == product_id].sort_values("date")
    if g.empty:
        print(f"No data for product {product_id}")
        return
    med = g["median_price"].iloc[0]
    g_out = g[g["is_outlier"]]

    plt.figure(figsize=(12, 4))
    plt.plot(g["date"], g["price"], label="Price", color="#1f77b4")
    plt.axhline(med, color="#ff7f0e", linestyle="--", label="Median (static baseline)")
    if not g_out.empty:
        plt.scatter(g_out["date"], g_out["price"], color="red", s=30, label="Outliers")
    plt.title(f"Product {product_id} - Price vs Static Median")
    plt.xlabel("Date"); plt.ylabel("Price")
    plt.legend(); plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, f"series_static_{product_id}.png")
    plt.savefig(path, dpi=160); plt.show(block=True)

    print(f"Saved product series → {path}")

# Example:
# plot_product_static_baseline(df['product_id'].iloc[0])
# plot_product_static_baseline('your-product-id-here')
    
# create PDF for each product's price trend
from matplotlib.backends.backend_pdf import PdfPages

pdf_path = os.path.join(OUTPUT_DIR, "product_trends.pdf")
with PdfPages(pdf_path) as pdf:
    for pid in df["product_id"].unique():
        g = flagged[flagged["product_id"] == pid].sort_values("date")
        if g.empty:
            continue

        med  = g["median_price"].iloc[0]
        mean = g["mean_price"].iloc[0]
        q1   = g["q1"].iloc[0]
        q3   = g["q3"].iloc[0]

        fig, ax = plt.subplots(figsize=(12, 4))
        ax.plot(g["date"], g["price"], color="#1f77b4", linewidth=1.5, label="Price")
        ax.scatter(g["date"], g["price"], color="#1f77b4", s=10, alpha=0.6)

        ax.axhline(med,  color="#ff7f0e", linestyle="--", linewidth=1.2, label="Median")
        ax.axhline(mean, color="#2ca02c", linestyle="-.",  linewidth=1.2, label="Mean")
        ax.fill_between([g["date"].min(), g["date"].max()], q1, q3, color="#ff7f0e", alpha=0.15, label="IQR band")

        out = g[g["is_outlier"]]
        if not out.empty:
            ax.scatter(out["date"], out["price"], color="red", s=30, zorder=3, label="Outlier")

        ax.set_title(f"Product {pid} — Price vs Static Baseline")
        ax.set_xlabel("Date"); ax.set_ylabel("Price")
        ax.legend(loc="best")
        fig.autofmt_xdate()
        fig.tight_layout()

        pdf.savefig(fig)
        plt.close(fig)

print(f"Saved multi-page PDF: {pdf_path}")