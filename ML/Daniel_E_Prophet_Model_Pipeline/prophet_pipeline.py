"""
Prophet Weekly Price Forecasting Pipeline - Jenkins Version
Reads DATA_PATH from environment variable for flexibility
"""

import pandas as pd
import numpy as np
from pathlib import Path
from itertools import product
import os
import warnings
warnings.filterwarnings('ignore')

from prophet import Prophet
from sklearn.metrics import mean_absolute_error, mean_squared_error, mean_absolute_percentage_error


# =============================================================================
# CONFIGURATION
# =============================================================================

# DATA_PATH and OUTPUT_PATH are read from environment variables at runtime.
# In Jenkins these are injected automatically via the Jenkinsfile environment block.
# When running locally, set them in your terminal before running:
#   export DATA_PATH=/path/to/csv/folder
#   export OUTPUT_PATH=/path/to/output/folder
# If neither are set, the fallback defaults below are used.
# UPDATE the fallback defaults to match directory structure.

DATA_DIR = os.getenv('DATA_PATH', '/path/to/data/directory')
OUTPUT_DIR = os.getenv('OUTPUT_PATH', str(Path.home() / 'prophet_predictions'))

CONFIG = {
    'DATA_PATH': DATA_DIR,
    'OUTPUT_PATH': Path(OUTPUT_DIR),

    # SKUs to forecast
    'TARGET_SKUS': [722, 6022833, 196774, 25, 320104],

    # Model settings
    'MIN_OBSERVATIONS': 8,
    'TEST_WEEKS': 3,
    'FORECAST_WEEKS': 5,

    # Price tier thresholds (used for contextualising error metrics in output)
    'PRICE_TIER_LOW': 5.0,
    'PRICE_TIER_HIGH': 20.0,

    # Hyperparameter grid — 3x6 = 18 combinations
    # seasonality_prior_scale: all seasonality components are disabled so this
    #   has minimal effect, but keeping 3 values (low/default/high) costs little
    #   and guards against edge cases where Prophet's internal components activate
    # regressor_prior_scale: broader coverage in the mid-range where retail
    #   promotional discounts typically land
    'PARAM_GRID': {
        'seasonality_prior_scale': [0.1, 1.0, 10.0],
        'regressor_prior_scale': [0.1, 0.5, 2.0, 5.0, 20.0, 50.0]
    }
}

CONFIG['OUTPUT_PATH'].mkdir(exist_ok=True, parents=True)

print(f"Reading data from: {CONFIG['DATA_PATH']}")
print(f"Writing output to: {CONFIG['OUTPUT_PATH']}")


# =============================================================================
# DATA LOADING
# =============================================================================

def load_data(data_path: str) -> pd.DataFrame:
    """Load and concatenate all CSV files from directory."""
    data_dir = Path(data_path)

    if not data_dir.exists():
        raise FileNotFoundError(f"Data directory not found: {data_dir}")

    csv_files = list(data_dir.glob("*.csv"))

    if not csv_files:
        raise FileNotFoundError(f"No CSV files found in: {data_dir}")

    print(f"Found {len(csv_files)} CSV files")

    dfs = []
    for csv_file in csv_files:
        df = pd.read_csv(csv_file, low_memory=False)
        dfs.append(df)
        print(f"  Loaded: {csv_file.name} ({len(df):,} rows)")

    return pd.concat(dfs, ignore_index=True)


def prepare_weekly_data(df: pd.DataFrame) -> pd.DataFrame:
    """Convert to weekly aggregated format."""
    df['Timestamp'] = pd.to_datetime(df['Timestamp'], errors='coerce')
    df = df.dropna(subset=['Timestamp'])
    df['Week'] = df['Timestamp'].dt.to_period('W-SUN').dt.start_time

    df_weekly = df.groupby(['Stockcode', 'Week', 'Name'], as_index=False).agg({
        'Price': 'first',
        'IsOnSpecial': lambda x: 1 if x.any() else 0
    })

    df_weekly = df_weekly.rename(columns={'Week': 'Timestamp'})
    return df_weekly


# =============================================================================
# PROMOTIONAL PATTERN DETECTION
# =============================================================================

def detect_promotional_patterns(df_product: pd.DataFrame) -> dict:
    """Analyze historical promotional timing."""
    df_sorted = df_product.sort_values('Timestamp').reset_index(drop=True)
    is_special = df_sorted['IsOnSpecial'].fillna(0).astype(int).values

    promo_starts, promo_durations = [], []
    in_promo, promo_start_idx = False, 0

    for i, val in enumerate(is_special):
        if val == 1 and not in_promo:
            in_promo, promo_start_idx = True, i
        elif val == 0 and in_promo:
            in_promo = False
            promo_starts.append(promo_start_idx)
            promo_durations.append(i - promo_start_idx)

    if in_promo:
        promo_starts.append(promo_start_idx)
        promo_durations.append(len(is_special) - promo_start_idx)

    promo_intervals = [
        promo_starts[i] - (promo_starts[i-1] + promo_durations[i-1])
        for i in range(1, len(promo_starts))
    ]

    regular_prices = df_sorted[df_sorted['IsOnSpecial'] == 0]['Price']
    price_volatility = (regular_prices.std() / regular_prices.mean()) if len(regular_prices) > 1 else 0.0

    pattern_quality = 'good'
    if len(promo_starts) == 0:
        pattern_quality = 'no_promotions'
    elif len(promo_starts) < 2:
        pattern_quality = 'insufficient_data'
    elif len(promo_intervals) > 0:
        interval_cv = np.std(promo_intervals) / np.mean(promo_intervals)
        if interval_cv > 0.5:
            pattern_quality = 'irregular'

    return {
        'avg_interval': np.mean(promo_intervals) if promo_intervals else 4,
        'avg_duration': np.mean(promo_durations) if promo_durations else 1,
        'promo_probability': np.sum(is_special) / len(is_special),
        'num_promos': len(promo_starts),
        'price_volatility': price_volatility,
        'pattern_quality': pattern_quality,
        'total_observations': len(df_sorted)
    }


def generate_future_promotions(last_date: pd.Timestamp, forecast_weeks: int,
                               promo_pattern: dict, last_was_special: bool = False) -> pd.DataFrame:
    """Generate predicted promotional schedule."""
    future_dates = pd.date_range(
        start=last_date + pd.Timedelta(days=7),
        periods=forecast_weeks,
        freq='7D'
    )

    is_on_special = np.zeros(forecast_weeks, dtype=int)

    # No promotions detected historically — forecast all weeks as regular price
    if promo_pattern['pattern_quality'] == 'no_promotions':
        return pd.DataFrame({'ds': future_dates, 'is_on_special': is_on_special})

    avg_interval = int(promo_pattern['avg_interval'])
    avg_duration = int(np.ceil(promo_pattern['avg_duration']))
    next_promo_start = avg_interval if last_was_special else max(1, avg_interval // 2)

    current_week = 0
    while current_week < forecast_weeks:
        current_week += next_promo_start
        for i in range(avg_duration):
            if current_week + i < forecast_weeks:
                is_on_special[current_week + i] = 1
        current_week += avg_duration
        next_promo_start = avg_interval

    return pd.DataFrame({'ds': future_dates, 'is_on_special': is_on_special})


def get_price_tier(median_price: float) -> str:
    """Classify product into price tier for contextualising error metrics."""
    if median_price < CONFIG['PRICE_TIER_LOW']:
        return 'low'
    elif median_price < CONFIG['PRICE_TIER_HIGH']:
        return 'mid'
    else:
        return 'high'


# =============================================================================
# MODEL TRAINING
# =============================================================================

def grid_search_prophet(df_train: pd.DataFrame, df_test: pd.DataFrame,
                        has_promotions: bool) -> dict:
    """
    Grid search over 3x6 hyperparameter combinations.
    - seasonality_prior_scale: 3 values (low / default / high)
    - regressor_prior_scale: 6 values with mid-range coverage
    For no-promo SKUs, regressor is omitted and only 3 combinations are run.
    Model selection uses MAPE so cheap and expensive products are evaluated
    on the same relative scale. MAE and RMSE are reported for dollar context.
    """
    train_prophet = pd.DataFrame({
        'ds': df_train['Timestamp'],
        'y': df_train['Price'],
        'is_on_special': df_train['IsOnSpecial'].fillna(0).astype(int)
    })

    test_prophet = pd.DataFrame({
        'ds': df_test['Timestamp'],
        'is_on_special': df_test['IsOnSpecial'].fillna(0).astype(int)
    })

    print(f"  Training data shape: {train_prophet.shape}")
    print(f"  Training date range: {train_prophet['ds'].min()} to {train_prophet['ds'].max()}")
    print(f"  Training y values: min={train_prophet['y'].min():.2f}, max={train_prophet['y'].max():.2f}")
    print(f"  Has promotions: {has_promotions}")
    if has_promotions:
        print(f"  Special flag distribution: {train_prophet['is_on_special'].value_counts().to_dict()}")

    if has_promotions:
        param_combinations = list(product(
            CONFIG['PARAM_GRID']['seasonality_prior_scale'],
            CONFIG['PARAM_GRID']['regressor_prior_scale']
        ))
    else:
        # No regressor — only search over seasonality scale (3 combinations)
        param_combinations = [
            (seas_scale, None)
            for seas_scale in CONFIG['PARAM_GRID']['seasonality_prior_scale']
        ]

    print(f"  Grid search: {len(param_combinations)} combinations")

    results = []
    errors = []

    for seas_scale, reg_scale in param_combinations:
        try:
            model = Prophet(
                growth='flat',
                yearly_seasonality=False,
                weekly_seasonality=False,
                daily_seasonality=False,
                seasonality_prior_scale=seas_scale
            )
            if has_promotions:
                model.add_regressor('is_on_special', prior_scale=reg_scale)

            model.fit(train_prophet)
            forecast = model.predict(test_prophet)

            mae = mean_absolute_error(df_test['Price'], forecast['yhat'].values)
            rmse = np.sqrt(mean_squared_error(df_test['Price'], forecast['yhat'].values))
            mape = mean_absolute_percentage_error(df_test['Price'], forecast['yhat'].values)

            results.append({
                'seasonality_prior_scale': seas_scale,
                'regressor_prior_scale': reg_scale,
                'mae': mae,
                'rmse': rmse,
                'mape': mape,
                'model': model
            })
        except Exception as e:
            error_msg = f"seas={seas_scale}, reg={reg_scale}: {str(e)}"
            errors.append(error_msg)
            print(f"  ⚠️  {error_msg}")
            continue

    if errors:
        print(f"  Result: {len(results)}/{len(param_combinations)} succeeded, {len(errors)} failed")
        if not results:
            print(f"  ALL FAILED. First error: {errors[0]}")

    if not results:
        return None

    return min(results, key=lambda x: x['mape'])


def train_and_predict_product(df_product: pd.DataFrame, stockcode: int) -> dict:
    """
    Full pipeline for a single product:
    1. Train/test split
    2. Grid search on train/test to find best hyperparameters
    3. Retrain best model on full dataset
    4. Forecast FORECAST_WEEKS beyond most recent data point
    """
    df_sorted = df_product.sort_values('Timestamp').reset_index(drop=True)

    if len(df_sorted) < CONFIG['MIN_OBSERVATIONS']:
        return None

    split_idx = len(df_sorted) - CONFIG['TEST_WEEKS']
    if split_idx < CONFIG['MIN_OBSERVATIONS']:
        return None

    df_train = df_sorted.iloc[:split_idx]
    df_test = df_sorted.iloc[split_idx:]

    # Detect promo patterns on full dataset so the forecast schedule
    # reflects the most recent promotional behaviour
    promo_pattern = detect_promotional_patterns(df_sorted)
    has_promotions = promo_pattern['pattern_quality'] != 'no_promotions'

    if not has_promotions:
        print(f"  ℹ️  No promotional history — forecasting regular price only")

    # Step 1 & 2: grid search on train/test split
    best_result = grid_search_prophet(df_train, df_test, has_promotions)

    if best_result is None:
        return None

    # Step 3: retrain winning hyperparameters on full dataset
    full_prophet = pd.DataFrame({
        'ds': df_sorted['Timestamp'],
        'y': df_sorted['Price'],
        'is_on_special': df_sorted['IsOnSpecial'].fillna(0).astype(int)
    })

    final_model = Prophet(
        growth='flat',
        yearly_seasonality=False,
        weekly_seasonality=False,
        daily_seasonality=False,
        seasonality_prior_scale=best_result['seasonality_prior_scale']
    )
    if has_promotions:
        final_model.add_regressor('is_on_special', prior_scale=best_result['regressor_prior_scale'])

    final_model.fit(full_prophet)

    # Step 4: forecast from most recent data point
    last_date = df_sorted['Timestamp'].max()
    last_was_special = df_sorted['IsOnSpecial'].iloc[-1] == 1

    future_promo_df = generate_future_promotions(
        last_date, CONFIG['FORECAST_WEEKS'], promo_pattern, last_was_special
    )

    forecast = final_model.predict(future_promo_df)

    median_price = df_sorted[df_sorted['IsOnSpecial'] == 0]['Price'].median()
    if pd.isna(median_price):
        median_price = df_sorted['Price'].median()
    price_tier = get_price_tier(median_price)

    predictions = pd.DataFrame({
        'Date': future_promo_df['ds'],
        'Predicted_Price': forecast['yhat'].round(2),
        'Lower_Bound': forecast['yhat_lower'].round(2),
        'Upper_Bound': forecast['yhat_upper'].round(2),
        'Predicted_OnSpecial': future_promo_df['is_on_special'],
        'Price_Tier': price_tier
    })

    return {
        'predictions': predictions,
        'metrics': {
            'mae': best_result['mae'],
            'rmse': best_result['rmse'],
            'mape': best_result['mape']
        },
        'best_params': {
            'seasonality_prior_scale': best_result['seasonality_prior_scale'],
            'regressor_prior_scale': best_result['regressor_prior_scale']
        },
        'promo_pattern': promo_pattern,
        'n_observations': len(df_sorted),
        'product_name': df_product['Name'].iloc[0] if 'Name' in df_product.columns else None,
        'price_tier': price_tier,
        'median_regular_price': round(median_price, 2)
    }


# =============================================================================
# BATCH PROCESSING
# =============================================================================

def process_skus(df_weekly: pd.DataFrame, sku_list: list) -> pd.DataFrame:
    """Train and predict for list of SKUs."""
    all_predictions = []
    summary = []

    print(f"\nProcessing {len(sku_list)} SKUs...")
    print("=" * 80)

    for i, stockcode in enumerate(sku_list, 1):
        print(f"\n[{i}/{len(sku_list)}] SKU: {stockcode}")

        df_product = df_weekly[df_weekly['Stockcode'] == stockcode].copy()

        if len(df_product) == 0:
            print("❌ No data found")
            continue

        print(f"Data: {len(df_product)} weeks")
        result = train_and_predict_product(df_product, stockcode)

        if result is None:
            print(f"❌ Failed")
            continue

        predictions = result['predictions'].copy()
        predictions['Stockcode'] = stockcode
        predictions['Product_Name'] = result['product_name']
        predictions['Retailer'] = 'Woolworths'
        all_predictions.append(predictions)

        print(f"✓ Success — MAPE: {result['metrics']['mape']*100:.1f}%  MAE: ${result['metrics']['mae']:.2f}  Tier: {result['price_tier']}")

        summary.append({
            'Stockcode': stockcode,
            'Product': result['product_name'],
            'Price_Tier': result['price_tier'],
            'Median_Regular_Price': result['median_regular_price'],
            'MAPE_%': round(result['metrics']['mape'] * 100, 1),
            'MAE_$': round(result['metrics']['mae'], 2),
            'Promo_Pattern': result['promo_pattern']['pattern_quality'],
            'Seasonality_Scale': result['best_params']['seasonality_prior_scale'],
            'Regressor_Scale': result['best_params']['regressor_prior_scale']
        })

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    df_summary = pd.DataFrame(summary)
    print(df_summary.to_string(index=False))

    if all_predictions:
        return pd.concat(all_predictions, ignore_index=True)
    else:
        return pd.DataFrame()


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("=" * 80)
    print("PROPHET WEEKLY FORECASTING PIPELINE")
    print("=" * 80)

    df_raw = load_data(CONFIG['DATA_PATH'])
    print(f"\nTotal observations: {len(df_raw):,}")

    df_weekly = prepare_weekly_data(df_raw)
    print(f"Weekly observations: {len(df_weekly):,}")

    df_predictions = process_skus(df_weekly, CONFIG['TARGET_SKUS'])

    if not df_predictions.empty:
        output_file = CONFIG['OUTPUT_PATH'] / 'weekly_predictions.csv'
        df_predictions.to_csv(output_file, index=False)
        print(f"\n✓ Predictions saved: {output_file}")
        print(f"  Total predictions: {len(df_predictions)} rows")
    else:
        print("\n❌ No predictions generated")

    return df_predictions


if __name__ == "__main__":
    predictions = main()
