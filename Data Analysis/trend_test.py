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
    print("No sales (price drops) detected for this product — monthly sales frequency plot not generated.")

# =========================
# Trend Analysis 
# =========================
def run_trend_analysis_4(existing_df):
    # Local imports 
    import numpy as np
    import pandas as pd
    import matplotlib.pyplot as plt
    from pathlib import Path
    from typing import Optional, Dict

    # ---------- config / io ----------
    OUTPUT_DIR = Path("Data Analysis/outputs")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    SUMMARY_CSV     = OUTPUT_DIR / "product_sale_summary.csv"
    PREDICTIONS_CSV = OUTPUT_DIR / "product_next_sale_predictions.csv"

    # ---------- helpers ----------
    def _pick(df_local: pd.DataFrame, candidates, required=True):
        cols_lower = [c.lower() for c in df_local.columns]
        for cand in candidates:
            if cand in cols_lower:
                return df_local.columns[cols_lower.index(cand)]
        if required:
            raise ValueError(f"Could not find any of {candidates} in columns {df_local.columns.tolist()}")
        return None

    def _nearest_holiday_days(d, holidays: Dict[str, pd.Timestamp]) -> float:
        if pd.isna(d) or not holidays:
            return np.nan
        if isinstance(d, pd.Timedelta):
            return np.nan
        d = pd.to_datetime(d, errors="coerce")
        if pd.isna(d):
            return np.nan
        try:
            return float(min(abs((d - h)).days for h in holidays.values()))
        except Exception:
            return np.nan

    def _gap_days(series: pd.Series) -> pd.Series:
        if pd.api.types.is_timedelta64_dtype(series):
            return series.diff().dt.total_seconds() / 86400.0
        else:
            return pd.to_datetime(series).diff().dt.days.astype("float")

    def summarize_product(group: pd.DataFrame,
                          date_col: str,
                          price_col: str,
                          units_col: Optional[str],
                          holidays: Dict[str, pd.Timestamp],
                          window_days: int = 7) -> pd.Series:
        g = group.sort_values(date_col).copy()
        g["price_diff"] = g[price_col].diff()
        sales = g[g["price_diff"] < 0].copy()
        n_sales = len(sales)
        last_sale = sales[date_col].max() if n_sales else pd.NaT

        if n_sales >= 2:
            gaps = _gap_days(sales[date_col]).dropna()
            avg_gap = float(gaps.mean()) if len(gaps) else np.nan
            med_gap = float(gaps.median()) if len(gaps) else np.nan
            gap_days = med_gap if pd.notna(med_gap) else avg_gap
            predicted_next_sale = (
                last_sale + pd.to_timedelta(float(gap_days), unit="D")
                if pd.notna(last_sale) and pd.notna(gap_days) else pd.NaT
            )
        else:
            avg_gap = med_gap = np.nan
            predicted_next_sale = pd.NaT

        if n_sales and not pd.api.types.is_timedelta64_dtype(sales[date_col]):
            sales["days_to_nearest_holiday"] = sales[date_col].apply(lambda d: _nearest_holiday_days(d, holidays))
            pct_near_holiday = (sales["days_to_nearest_holiday"] <= window_days).mean() * 100
        else:
            pct_near_holiday = np.nan

        out = {
            "n_sales": n_sales,
            "last_sale_date": last_sale,
            "avg_gap_days": avg_gap,
            "median_gap_days": med_gap,
            "predicted_next_sale": predicted_next_sale,
            "pct_sales_near_holiday": pct_near_holiday,
            "avg_unit_price": g[price_col].mean(),
            "min_unit_price": g[price_col].min(),
            "max_unit_price": g[price_col].max(),
        }
        if units_col:
            out.update({
                "total_units_sold": g[units_col].sum(),
                "avg_units_per_txn": g[units_col].mean(),
            })
        return pd.Series(out)

 # ---------- using existing df if compatible; else auto-detect ----------
    df2 = existing_df.copy()

    if {"date", "product_id", "price"}.issubset(set(df2.columns)):
        date_col  = "date"
        price_col = "price"
        sku_col   = "product_id"
        units_col: Optional[str] = "quantity" if "quantity" in df2.columns else None

        df2[date_col]  = pd.to_datetime(df2[date_col], errors="coerce")
        df2[price_col] = pd.to_numeric(df2[price_col], errors="coerce")
        if units_col:
            df2[units_col] = pd.to_numeric(df2[units_col], errors="coerce")
    else:
        date_col  = _pick(df2, ["date","datetime","timestamp","transaction_date","sale_date"])
        price_col = _pick(df2, ["unit_price","price","sale_price","regular_price"])
        sku_col   = _pick(df2, ["sku","product_id","product","item_id","productcode"])
        units_col = _pick(df2, ["units_sold","quantity","qty","units","sales_qty"], required=False)

        raw_date = df2[date_col].astype(str).str.strip()
        dur_pat = r"^\d{1,2}:\d{2}(?:\.\d+)?$"
        if raw_date.str.match(dur_pat).all():
            df2[date_col] = pd.to_timedelta("00:" + raw_date, errors="coerce")
        else:
            df2[date_col] = pd.to_datetime(raw_date, errors="coerce")

        df2[price_col] = pd.to_numeric(df2[price_col], errors="coerce")
        if units_col:
            df2[units_col] = pd.to_numeric(df2[units_col], errors="coerce")

    df2 = df2.dropna(subset=[date_col, price_col, sku_col]).sort_values([sku_col, date_col]).reset_index(drop=True)

# ---------- holidays  ----------
    if pd.api.types.is_datetime64_any_dtype(df2[date_col]):
        years = sorted(df2[date_col].dt.year.unique().tolist())
        base_holidays = {
            "New Year’s Day": (1, 1),
            "ANZAC Day": (4, 25),
            "EOFY": (6, 30),
            "Christmas Day": (12, 25),
            "Boxing Day": (12, 26),
            # simple approximations for demo
            "Good Friday": (4, 18),
            "Easter Monday": (4, 21),
        }
        HOLIDAYS = {f"{name} {y}": pd.Timestamp(year=y, month=m, day=d)
                    for y in years for name, (m, d) in base_holidays.items()}
        HOLIDAY_WINDOW_DAYS = 7
    else:
        HOLIDAYS = {}
        HOLIDAY_WINDOW_DAYS = 7

 # ---------- single-product demo (most common by rows) ----------
    most_common_prod = df2[sku_col].value_counts().idxmax()
    one = df2[df2[sku_col] == most_common_prod].copy().sort_values(date_col)
    one["price_diff"] = one[price_col].diff()
    sales_one = one[one["price_diff"] < 0].copy()

    if not sales_one.empty and sales_one[date_col].nunique() >= 2:
        gaps = _gap_days(sales_one[date_col]).dropna()
        gap = gaps.median() if pd.notna(gaps.median()) else gaps.mean()
        last_sale_value = sales_one[date_col].max()
        predicted_next = last_sale_value + pd.to_timedelta(float(gap), unit="D") if pd.notna(gap) else pd.NaT

        if pd.api.types.is_datetime64_any_dtype(sales_one[date_col]):
            pretty = predicted_next.date() if pd.notna(predicted_next) else "NaT"
            label = "date"
        else:
            pretty = str(predicted_next) if pd.notna(predicted_next) else "NaT"
            label = "offset"
        print(f"[TA4:{most_common_prod}] Predicted next sale {label} (gap≈{float(gap):.2f} days): {pretty}")
    else:
        print(f"[TA4:{most_common_prod}] Not enough sale events to estimate a next sale.")

    if not sales_one.empty:
        sales_one["days_to_nearest_holiday"] = sales_one[date_col].apply(lambda d: _nearest_holiday_days(d, HOLIDAYS))
        sales_one["near_holiday"] = sales_one["days_to_nearest_holiday"] <= HOLIDAY_WINDOW_DAYS
        near_count = int(sales_one["near_holiday"].sum())
        total_sales = len(sales_one)
        pct = (near_count / total_sales) * 100 if total_sales else 0
        print(f"[TA4:{most_common_prod}] {near_count}/{total_sales} sales ({pct:.1f}%) within ±{HOLIDAY_WINDOW_DAYS} days of a holiday.")

    # ---------- multi-product summary ----------
    _used_cols = [date_col, price_col] + ([units_col] if units_col else [])
    summary = (
        df2[[sku_col] + _used_cols]
          .groupby(sku_col, group_keys=False)[_used_cols]
          .apply(
              summarize_product,
              date_col=date_col,
              price_col=price_col,
              units_col=units_col,
              holidays=HOLIDAYS,
              window_days=HOLIDAY_WINDOW_DAYS
          )
          .reset_index()
          .rename(columns={sku_col: "product_id"})
          .sort_values(["n_sales", "pct_sales_near_holiday"], ascending=[False, False])
          .reset_index(drop=True)
    )
    print("\n[TA4] Summary preview (top 10):")
    print(summary.head(10).to_string(index=False))
    summary.to_csv(SUMMARY_CSV, index=False)
    print(f"[TA4] Saved summary -> {SUMMARY_CSV}")
# ---------- next-sale predictions for all products ----------
    pred_rows = []
    for pid, g in df2.groupby(sku_col):
        g = g.sort_values(date_col).copy()
        g["price_diff"] = g[price_col].diff()
        sales = g[g["price_diff"] < 0]
        if len(sales) >= 2:
            gaps = _gap_days(sales[date_col]).dropna()
            avg_gap = float(gaps.mean()) if len(gaps) else np.nan
            med_gap = float(gaps.median()) if len(gaps) else np.nan
            gap = med_gap if pd.notna(med_gap) else avg_gap
            last_sale = sales[date_col].max()
            next_sale = last_sale + pd.to_timedelta(float(gap), unit="D") if (pd.notna(last_sale) and pd.notna(gap)) else pd.NaT
        else:
            avg_gap = med_gap = gap = np.nan
            last_sale = pd.NaT
            next_sale = pd.NaT

        pred_rows.append({
            "product_id": pid,
            "last_sale_date": last_sale,
            "avg_gap_days": avg_gap,
            "median_gap_days": med_gap,
            "predicted_next_sale": next_sale
        })

    predictions_df = pd.DataFrame(pred_rows).sort_values("predicted_next_sale", na_position="last")
    print("\n[TA4] Next-sale predictions preview (top 10):")
    print(predictions_df.head(10).to_string(index=False))
    predictions_df.to_csv(PREDICTIONS_CSV, index=False)
    print(f"[TA4] Saved predictions -> {PREDICTIONS_CSV}")

 # ---------- quick visuals ----------
    valid_holiday_data = summary.dropna(subset=["pct_sales_near_holiday"])
    valid_holiday_data = valid_holiday_data[valid_holiday_data["pct_sales_near_holiday"] > 0]
    if not valid_holiday_data.empty:
        top_holiday = valid_holiday_data.nlargest(10, "pct_sales_near_holiday")
        plt.figure(figsize=(12, 5))
        plt.bar(top_holiday["product_id"].astype(str), top_holiday["pct_sales_near_holiday"], edgecolor="black")
        plt.title(f"Top {len(top_holiday)} Products — % Sales Within ±7 Days of Holidays")
        plt.ylabel("% of Sales Near Holidays")
        plt.xlabel("Product")
        plt.xticks(rotation=45, ha="right")
        plt.tight_layout()
        plt.show()
    else:
        print("[TA4] No products with sales within holiday window (or dates are durations).")

    # Simple backtest 
    sales_dates = sales_one[date_col].sort_values().tolist() if not sales_one.empty else []
    if len(sales_dates) >= 4 and pd.api.types.is_datetime64_any_dtype(pd.Series(sales_dates)):
        preds, actuals = [], []
        for i in range(3, len(sales_dates)-1):
            history = pd.Series(sales_dates[:i]).sort_values()
            gaps = history.diff().dt.days.dropna()
            if gaps.empty:
                continue
            gap_est = gaps.median() if pd.notna(gaps.median()) else gaps.mean()
            pred_next = history.iloc[-1] + pd.Timedelta(days=float(gap_est))
            actual_next = sales_dates[i]
            preds.append(pred_next)
            actuals.append(actual_next)
        if preds:
            errors = [(a - p).days for p, a in zip(preds, actuals)]
            mae = np.mean(np.abs(errors))
            print(f"[TA4 Backtest] MAE (days) using rolling median-gap rule: {mae:.2f}")
        else:
            print("[TA4 Backtest] Not enough rolling windows to evaluate.")
    else:
        print("[TA4 Backtest] Not enough sale events or non-datetime dates.")

try:
    run_trend_analysis_4(df)
except Exception as _e:
    print(f"[TA4] Skipped due to error: {_e}")
=======
    print("[PED] Skipped: 'quantity' column not present in dataset.")