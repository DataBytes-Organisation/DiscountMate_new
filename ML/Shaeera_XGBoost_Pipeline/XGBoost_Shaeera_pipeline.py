"""
XGBoost Weekly Price Forecasting Pipeline
Production-style retail price forecasting pipeline.

Features:
- Weekly aggregation
- Recursive forecasting
- Per-SKU modeling
- Time-series-safe feature engineering
- Hyperparameter optimization
- Confidence intervals
- Feature importance export
- Batch SKU processing
- Model persistence

Recommended for retail pricing datasets.
"""

import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import numpy as np
from pathlib import Path
from itertools import product
import pickle

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)

from sklearn.model_selection import TimeSeriesSplit

from xgboost import XGBRegressor


# =============================================================================
# CONFIGURATION
# =============================================================================

CONFIG = {

    # -------------------------------------------------------------------------
    # DATA
    # -------------------------------------------------------------------------

    'DATA_PATH': '__',

    # OUTPUT
    'OUTPUT_PATH': Path.home() / 'xgboost_predictions',
    'MODEL_PATH': Path.home() / 'xgboost_models',

    # TARGET SKUS
    'TARGET_SKUS': [722, 6022833, 196774, 25, 320104],

    # -------------------------------------------------------------------------
    # FORECAST SETTINGS
    # -------------------------------------------------------------------------

    'FORECAST_WEEKS': 4,
    'TEST_WEEKS': 4,
    'MIN_OBSERVATIONS': 20,

    # -------------------------------------------------------------------------
    # LAG SETTINGS
    # -------------------------------------------------------------------------

    'LAGS': [1, 2, 3, 4, 8],

    # -------------------------------------------------------------------------
    # ROLLING WINDOWS
    # -------------------------------------------------------------------------

    'ROLLING_WINDOWS': [4, 8, 12],

    # -------------------------------------------------------------------------
    # XGBOOST GRID
    # -------------------------------------------------------------------------

    'PARAM_GRID': {
        'n_estimators': [300, 500],
        'learning_rate': [0.03, 0.05],
        'max_depth': [4, 6],
        'subsample': [0.8],
        'colsample_bytree': [0.8]
    },

    # RANDOM STATE
    'RANDOM_STATE': 42
}

CONFIG['OUTPUT_PATH'].mkdir(exist_ok=True, parents=True)
CONFIG['MODEL_PATH'].mkdir(exist_ok=True, parents=True)

# =============================================================================
# DATA LOADING
# =============================================================================


def load_data(data_path: str) -> pd.DataFrame:
    """Load CSV dataset."""

    df = pd.read_csv(data_path)

    return df


# =============================================================================
# DATA CLEANING
# =============================================================================


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """Clean raw retail data."""

    df = df.copy()

    # Remove invalid prices
    df = df[(df['unit_price_x'] > 0)]
    df = df[df['unit_price_x'].notna()]

    # Parse dates
    df['RunDate'] = pd.to_datetime(
        df['RunDate'],
        dayfirst=True,
        errors='coerce'
    )

    df = df.dropna(subset=['RunDate'])

    # Remove duplicates
    df = df.drop_duplicates()

    # Sort
    df = df.sort_values(['Sku', 'RunDate'])

    return df

# =============================================================================
# WEEKLY AGGREGATION
# =============================================================================


def prepare_weekly_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Convert daily data into weekly data.
    One row per SKU per week.
    """

    df = df.copy()

    # Create week
    df['Week'] = df['RunDate'].dt.to_period('W-SUN').dt.start_time

    # Aggregate weekly
    df_weekly = (
        df.groupby(['Sku', 'Week'], as_index=False)
        .agg({
            'unit_price_x': 'median'
        })
    )

    df_weekly = df_weekly.rename(columns={
        'Week': 'RunDate'
    })

    return df_weekly


# =============================================================================
# FEATURE ENGINEERING
# =============================================================================


def create_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create time-series forecasting features."""

    df = df.copy()

    # -------------------------------------------------------------------------
    # TIME FEATURES
    # -------------------------------------------------------------------------

    df['weekofyear'] = df['RunDate'].dt.isocalendar().week.astype(int)
    df['month'] = df['RunDate'].dt.month
    df['quarter'] = df['RunDate'].dt.quarter
    df['year'] = df['RunDate'].dt.year

    # -------------------------------------------------------------------------
    # CYCLICAL ENCODING
    # -------------------------------------------------------------------------

    df['week_sin'] = np.sin(2 * np.pi * df['weekofyear'] / 52)
    df['week_cos'] = np.cos(2 * np.pi * df['weekofyear'] / 52)

    # -------------------------------------------------------------------------
    # LAG FEATURES
    # -------------------------------------------------------------------------

    for lag in CONFIG['LAGS']:

        df[f'lag_{lag}'] = (
            df.groupby('Sku')['unit_price_x']
            .shift(lag)
        )

    # -------------------------------------------------------------------------
    # ROLLING FEATURES
    # -------------------------------------------------------------------------

    for window in CONFIG['ROLLING_WINDOWS']:

        df[f'rolling_mean_{window}'] = (
            df.groupby('Sku')['unit_price_x']
            .shift(1)
            .rolling(window)
            .mean()
        )

        df[f'rolling_std_{window}'] = (
            df.groupby('Sku')['unit_price_x']
            .shift(1)
            .rolling(window)
            .std()
        )

        df[f'rolling_min_{window}'] = (
            df.groupby('Sku')['unit_price_x']
            .shift(1)
            .rolling(window)
            .min()
        )

        df[f'rolling_max_{window}'] = (
            df.groupby('Sku')['unit_price_x']
            .shift(1)
            .rolling(window)
            .max()
        )

    # -------------------------------------------------------------------------
    # PRICE CHANGE FEATURES
    # -------------------------------------------------------------------------

    df['price_change_1'] = (
        df['lag_1'] - df['lag_2']
    )

    df['price_change_4'] = (
        df['lag_1'] - df['lag_4']
    )

    # -------------------------------------------------------------------------
    # VOLATILITY
    # -------------------------------------------------------------------------

    df['volatility_ratio'] = (
        df['rolling_std_4'] /
        (df['rolling_mean_4'] + 1e-6)
    )

    # -------------------------------------------------------------------------
    # TARGET
    # -------------------------------------------------------------------------

    df['target'] = (
        df.groupby('Sku')['unit_price_x']
        .shift(-1)
    )

    return df

# =============================================================================
# FEATURE LIST
# =============================================================================


def get_feature_columns() -> list:

    feature_cols = [

        'weekofyear',
        'month',
        'quarter',
        'year',

        'week_sin',
        'week_cos'
    ]

    for lag in CONFIG['LAGS']:
        feature_cols.append(f'lag_{lag}')

    for window in CONFIG['ROLLING_WINDOWS']:

        feature_cols.extend([
            f'rolling_mean_{window}',
            f'rolling_std_{window}',
            f'rolling_min_{window}',
            f'rolling_max_{window}'
        ])

    feature_cols.extend([
        'price_change_1',
        'price_change_4',
        'volatility_ratio'
    ])

    return feature_cols


# =============================================================================
# HYPERPARAMETER SEARCH
# =============================================================================


def grid_search_xgboost(
    X_train,
    y_train,
    X_test,
    y_test
):
    """Simple grid search."""

    param_grid = CONFIG['PARAM_GRID']

    combinations = list(product(
        param_grid['n_estimators'],
        param_grid['learning_rate'],
        param_grid['max_depth'],
        param_grid['subsample'],
        param_grid['colsample_bytree']
    ))

    results = []

    for (
        n_estimators,
        learning_rate,
        max_depth,
        subsample,
        colsample_bytree
    ) in combinations:

        try:

            model = XGBRegressor(
                n_estimators=n_estimators,
                learning_rate=learning_rate,
                max_depth=max_depth,
                subsample=subsample,
                colsample_bytree=colsample_bytree,
                objective='reg:squarederror',
                random_state=CONFIG['RANDOM_STATE']
            )

            model.fit(X_train, y_train)

            predictions = model.predict(X_test)

            mae = mean_absolute_error(y_test, predictions)
            rmse = np.sqrt(mean_squared_error(y_test, predictions))
            r2 = r2_score(y_test, predictions)

            results.append({
                'mae': mae,
                'rmse': rmse,
                'r2': r2,
                'model': model,
                'params': {
                    'n_estimators': n_estimators,
                    'learning_rate': learning_rate,
                    'max_depth': max_depth,
                    'subsample': subsample,
                    'colsample_bytree': colsample_bytree
                }
            })

        except Exception:
            continue

    if len(results) == 0:
        return None

    best_result = min(results, key=lambda x: x['mae'])

    return best_result

# =============================================================================
# RECURSIVE FORECASTING
# =============================================================================

def recursive_forecast(
    model,
    history_df,
    feature_cols,
    forecast_weeks
):
    """Generate recursive future forecasts."""

    history = history_df.copy()

    forecasts = []

    residual_std = history['unit_price_x'].std()

    last_date = history['RunDate'].max()

    for step in range(forecast_weeks):

        next_date = last_date + pd.Timedelta(days=7)

        temp_df = history.copy()

        future_row = {
            'Sku': temp_df['Sku'].iloc[0],
            'RunDate': next_date,
            'unit_price_x': np.nan
        }

        temp_df = pd.concat([
            temp_df,
            pd.DataFrame([future_row])
        ], ignore_index=True)

        temp_df = create_features(temp_df)

        latest_row = temp_df.iloc[-1:]

        X_future = latest_row[feature_cols].fillna(0)

        prediction = model.predict(X_future)[0]

        lower_bound = prediction - 1.96 * residual_std
        upper_bound = prediction + 1.96 * residual_std

        forecasts.append({
            'Date': next_date,
            'Predicted_Price': round(prediction, 2),
            'Lower_Bound': round(lower_bound, 2),
            'Upper_Bound': round(upper_bound, 2)
        })

        new_history_row = {
            'Sku': history['Sku'].iloc[0],
            'RunDate': next_date,
            'unit_price_x': prediction
        }

        history = pd.concat([
            history,
            pd.DataFrame([new_history_row])
        ], ignore_index=True)

        last_date = next_date

    return pd.DataFrame(forecasts)


# =============================================================================
# TRAIN SINGLE SKU
# =============================================================================
def train_and_predict_sku(
    df_product,
    stockcode
):
    """Train and forecast for one SKU."""

    df_product = df_product.sort_values('RunDate').reset_index(drop=True)

    # -------------------------------------------------------------------------
    # CONSTANT PRICE CHECK
    # -------------------------------------------------------------------------

    if df_product['unit_price_x'].nunique() == 1:

        constant_price = df_product['unit_price_x'].iloc[0]

        future_dates = pd.date_range(
            start=df_product['RunDate'].max() + pd.Timedelta(days=7),
            periods=CONFIG['FORECAST_WEEKS'],
            freq='W-SUN'
        )

        predictions = pd.DataFrame({
            'Date': future_dates,
            'Predicted_Price': constant_price,
            'Lower_Bound': constant_price,
            'Upper_Bound': constant_price
        })

        return {
            'predictions': predictions,
            'metrics': {
                'mae': 0,
                'rmse': 0,
                'r2': 1
            },
            'best_params': None,
            'feature_importance': None
        }

    # -------------------------------------------------------------------------
    # FEATURE ENGINEERING
    # -------------------------------------------------------------------------
    df_features = create_features(df_product)

    # Remove rows without target
    df_features = df_features.dropna(subset=['target'])

    # Remove NaNs from lag windows
    df_features = df_features.dropna()

    if len(df_features) < CONFIG['MIN_OBSERVATIONS']:
        return None

    feature_cols = get_feature_columns()

    X = df_features[feature_cols]
    y = df_features['target']
    # -------------------------------------------------------------------------
    # TRAIN TEST SPLIT
    # -------------------------------------------------------------------------

    split_idx = len(df_features) - CONFIG['TEST_WEEKS']

    if split_idx < CONFIG['MIN_OBSERVATIONS']:
        return None

    X_train = X.iloc[:split_idx]
    X_test = X.iloc[split_idx:]

    y_train = y.iloc[:split_idx]
    y_test = y.iloc[split_idx:]

    # -------------------------------------------------------------------------
    # GRID SEARCH
    # -------------------------------------------------------------------------

    best_result = grid_search_xgboost(
        X_train,
        y_train,
        X_test,
        y_test
    )

    if best_result is None:
        return None

    best_params = best_result['params']


    # -------------------------------------------------------------------------
    # RETRAIN FULL MODEL
    # -------------------------------------------------------------------------

    final_model = XGBRegressor(
        **best_params,
        objective='reg:squarederror',
        random_state=CONFIG['RANDOM_STATE']
    )

    final_model.fit(X, y)
    # -------------------------------------------------------------------------
    # SAVE MODEL
    # -------------------------------------------------------------------------
    model_path = CONFIG['MODEL_PATH'] / f'xgb_model_{stockcode}.pkl'

    with open(model_path, 'wb') as f:
        pickle.dump(final_model, f)
    # -------------------------------------------------------------------------
    # FEATURE IMPORTANCE
    # -------------------------------------------------------------------------

    feature_importance = pd.Series(
        final_model.feature_importances_,
        index=feature_cols
    ).sort_values(ascending=False)
    # -------------------------------------------------------------------------
    # RECURSIVE FORECASTING
    # -------------------------------------------------------------------------
    history_df = df_product.copy()

    predictions = recursive_forecast(
        final_model,
        history_df,
        feature_cols,
        CONFIG['FORECAST_WEEKS']
    )

    return {
        'predictions': predictions,
        'metrics': {
            'mae': best_result['mae'],
            'rmse': best_result['rmse'],
            'r2': best_result['r2']
        },
        'best_params': best_params,
        'feature_importance': feature_importance
    }

# =============================================================================
# PROCESS MULTIPLE SKUS
# =============================================================================

def process_skus(
    df_weekly,
    sku_list
):
    """Batch SKU forecasting."""

    all_predictions = []
    summary = []

    print('=' * 80)
    print('PROCESSING SKUS')
    print('=' * 80)

    for i, sku in enumerate(sku_list, 1):

        print(f'\n[{i}/{len(sku_list)}] SKU: {sku}')
        print('-' * 40)

        df_product = df_weekly[
            df_weekly['Sku'] == sku
        ].copy()

        if len(df_product) == 0:

            print('❌ No data found')

            summary.append({
                'Sku': sku,
                'Status': 'No data'
            })

            continue

        print(f'Observations: {len(df_product)} weeks')

        result = train_and_predict_sku(
            df_product,
            sku
        )

        if result is None:

            print('Failed')

            summary.append({
                'Sku': sku,
                'Status': 'Failed'
            })

            continue

        predictions = result['predictions'].copy()
        predictions['Sku'] = sku

        all_predictions.append(predictions)

        print('Success')
        print(f"MAE: {result['metrics']['mae']:.2f}")
        print(f"RMSE: {result['metrics']['rmse']:.2f}")
        print(f"R2: {result['metrics']['r2']:.4f}")

        print('\nTop Features:')
        print(result['feature_importance'].head(5))

        summary.append({
            'Sku': sku,
            'Status': 'Success',
            'MAE': result['metrics']['mae'],
            'RMSE': result['metrics']['rmse'],
            'R2': result['metrics']['r2']
        })

    print('\n' + '=' * 80)
    print('SUMMARY')
    print('=' * 80)

    summary_df = pd.DataFrame(summary)

    print(summary_df)

    if all_predictions:
        return pd.concat(all_predictions, ignore_index=True)

    return pd.DataFrame()
# =============================================================================
# EXPORT
# =============================================================================
def export_predictions(
    df_predictions,
    filename='xgboost_weekly_predictions.csv'
):
    """Export predictions."""

    output_path = CONFIG['OUTPUT_PATH'] / filename

    df_predictions.to_csv(output_path, index=False)

    print(f'\n✓ Exported predictions to: {output_path}')

    return output_path

# =============================================================================
# MAIN
# =============================================================================

def main():

    print('=' * 80)
    print('XGBOOST WEEKLY FORECASTING PIPELINE')
    print('=' * 80)

    # -------------------------------------------------------------------------
    # LOAD DATA
    # -------------------------------------------------------------------------

    print('\n1. Loading data...')

    df_raw = load_data(CONFIG['DATA_PATH'])

    print(f'Loaded {len(df_raw):,} rows')


    # -------------------------------------------------------------------------
    # CLEAN DATA
    # -------------------------------------------------------------------------

    print('\n2. Cleaning data...')

    df_clean = clean_data(df_raw)

    print(f'Clean rows: {len(df_clean):,}')


    # -------------------------------------------------------------------------
    # WEEKLY AGGREGATION
    # -------------------------------------------------------------------------

    print('\n3. Preparing weekly data...')

    df_weekly = prepare_weekly_data(df_clean)

    print(f'Weekly observations: {len(df_weekly):,}')

    print(
        f"Date range: "
        f"{df_weekly['RunDate'].min().date()} "
        f"to "
        f"{df_weekly['RunDate'].max().date()}"
    )


    # -------------------------------------------------------------------------
    # PROCESS SKUS
    # -------------------------------------------------------------------------

    print('\n4. Training and forecasting...')

    predictions = process_skus(
        df_weekly,
        CONFIG['TARGET_SKUS']
    )

    # -------------------------------------------------------------------------
    # EXPORT
    # -------------------------------------------------------------------------

    if not predictions.empty:

        print('\n5. Exporting predictions...')

        export_predictions(predictions)

        print('\n' + '=' * 80)
        print('PIPELINE COMPLETE')
        print('=' * 80)

        print(f'Total forecasts: {len(predictions)}')

    else:

        print('\n❌ No predictions generated')

    return predictions


if __name__ == '__main__':

    predictions = main()
    
