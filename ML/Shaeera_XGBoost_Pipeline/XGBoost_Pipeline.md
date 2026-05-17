# XGBoost Daily Price Forecasting Pipeline

**Technical Documentation**

---

## Overview

This pipeline performs daily supermarket price forecasting using an XGBoost regression model.

Historical pricing data is transformed into lag-based and rolling statistical features before training the model to predict product prices **7 days into the future**.

The workflow is intended for automation and future deployment into scheduled pipelines such as Jenkins.

| Inputs | Outputs |
|--------|---------|
| Historical product pricing dataset | Predicted future price |
| Columns used: `RunDate`, `Sku`, `unit_price_x` | 7-day ahead forecast |

---

## Model Objective

The model predicts:

```text
Future Price = Price at day t + 7
```

Target creation:

```python
future_price = unit_price_x shifted by -7 days
```

Meaning:

- Current observations become input features
- Target becomes price one week later

---

## Feature Engineering Pipeline

Feature generation occurs inside:

```python
create_features(df)
```

The dataset is copied and transformed into time-series predictors.

---

## 1. Time Features

Time-related variables capture seasonality and calendar effects.

Generated features:

| Feature | Description |
|----------|------------|
| `day_of_week` | Integer weekday (0–6) |
| `month` | Calendar month |
| `day_of_month` | Day index |
| `is_weekend` | Binary weekend indicator |

Example:

```text
Monday = 0
Sunday = 6
Weekend = 1
Weekday = 0
```

---

## 2. SKU Encoding

Products are converted into numerical values:

```python
df['Sku'] = (
    df['Sku']
    .astype('category')
    .cat.codes
)
```

Purpose:

- Allows XGBoost to distinguish products
- Enables multi-product learning

---

## 3. Lag Features

Historical prices are used as predictors.

Generated lags:

| Feature | Meaning |
|----------|---------|
| `lag_1` | Yesterday price |
| `lag_2` | Price two days ago |
| `lag_3` | Price three days ago |
| `lag_7` | Previous week |
| `lag_14` | Two weeks ago |

Implementation:

```python
shift(lag)
```

Applied per SKU.

---

## 4. Rolling Statistics

Rolling windows summarise recent behaviour.

### Rolling Means

Generated:

```text
rolling_mean_7
rolling_mean_14
rolling_mean_30
```

Purpose:

- Capture local trend
- Smooth price fluctuations
- Estimate normal pricing behaviour

---

### Rolling Standard Deviation

Feature:

```text
rolling_std_7
```

Purpose:

Measures recent volatility.

Higher values indicate unstable pricing.

---

### Rolling Min / Max

Generated:

```text
rolling_min_7
rolling_max_7
```

Purpose:

Estimate local price range.

Useful for:

- Promotions
- Discounts
- Temporary spikes

---

## 5. Price Change Features

Short-term movement indicators:

```text
price_change_1
price_change_7
```

Calculations:

```python
price_change_1 =
current price − lag_1

price_change_7 =
current price − lag_7
```

Purpose:

Detect:

- Discounts
- Price jumps
- Trend direction

---

## 6. Discount Estimation

Discount percentage:

```python
(
rolling_mean_30
-
unit_price_x
)
/
rolling_mean_30
× 100
```

Interpretation:

Positive:

```text
Current price below historical average
```

Negative:

```text
Current price above average
```

This approximates promotion intensity.

---

## Target Construction

Future target:

```python
future_price = (
groupby('Sku')
.shift(-7)
)
```

Prediction horizon:

```text
7 days ahead
```

Rows without targets are removed:

```python
dropna(subset=['future_price'])
```

Remaining missing values:

```python
fillna(0)
```

Backfilling:

```python
bfill()
```

is used for lag features.

---

## Training Features

Model inputs:

```python
feature_cols = [

'Sku',

'day_of_week',
'month',
'day_of_month',
'is_weekend',

'lag_1',
'lag_2',
'lag_3',
'lag_7',
'lag_14',

'rolling_mean_7',
'rolling_mean_14',
'rolling_mean_30',

'rolling_std_7',

'rolling_min_7',
'rolling_max_7',

'price_change_1',
'price_change_7',

'discount_percent'

]
```

Total features:

```text
19
```

Target:

```python
y = future_price
```

---

## Train/Test Split

Chronological ordering is preserved.

Dataset split:

```python
split = int(
total_rows * 0.8
)
```

Structure:

```text
80% Training
20% Testing
```

Additional constraint:

Minimum test size:

```text
10 rows
```

No random shuffling is applied.

This prevents time leakage.

---

## XGBoost Model Configuration

Model:

```python
XGBRegressor(
n_estimators=800,
learning_rate=0.02,
max_depth=8,
subsample=0.8,
colsample_bytree=0.8,
min_child_weight=2,
objective='reg:squarederror',
random_state=42
)
```

Parameter summary:

| Parameter | Value | Purpose |
|-----------|--------|----------|
| `n_estimators` | 800 | Number of trees |
| `learning_rate` | 0.02 | Boosting step size |
| `max_depth` | 8 | Tree complexity |
| `subsample` | 0.8 | Row sampling |
| `colsample_bytree` | 0.8 | Feature sampling |
| `min_child_weight` | 2 | Overfitting control |

---

## Model Training

Training:

```python
model.fit(
X_train,
y_train
)
```

The model learns:

- Historical prices
- Weekly behaviour
- Promotion effects
- Product differences
- Volatility patterns

---

## Evaluation Metrics

Performance metrics:

### MAE

```python
mean_absolute_error
```

Measures average error magnitude.

---

### RMSE

```python
sqrt(
mean_squared_error
)
```

Penalises large prediction errors.

---

### R² Score

```python
r2_score
```

Measures explained variance.

Range:

```text
1 = perfect fit

0 = no predictive power

<0 = worse than baseline
```

Console output:

```text
====================================
XGBOOST RESULTS
====================================

XGB MAE : 0.2134
XGB RMSE: 0.2872
XGB R2  : 0.91
```

---

## Known Limitations

### Recursive Lag Dependence

Model quality relies heavily on lag features.

Sparse histories reduce performance.

---

### Fixed Forecast Horizon

Current implementation predicts:

```text
7 days ahead only
```

Longer forecasts require:

- Recursive prediction
- Multi-step targets
- Separate horizon models

---

### Encoded SKU Limitation

SKU category encoding introduces arbitrary ordering.

Future improvement:

- Target encoding
- Embeddings
- One-hot encoding

---

### Missing External Signals

Current model excludes:

- Competitor prices
- Promotions from other retailers
- Catalogue events
- Inflation indicators

---

## Dependencies

Required packages:

```bash
pip install xgboost pandas numpy scikit-learn
```

Libraries used:

| Package | Purpose |
|----------|---------|
| xgboost | Regression model |
| pandas | Data processing |
| numpy | Numerical operations |
| scikit-learn | Metrics |
| datetime | Date handling |

---

## Future Development Opportunities

### Multi-Horizon Forecasting

Train separate models:

```text
t+1
t+7
t+14
t+30
```

---

### Feature Importance Analysis

Use:

- SHAP values
- Gain importance
- Permutation importance

to explain predictions.

---

### Ensemble Forecasting

Combine:

- XGBoost
- LSTM

to improve robustness.

---

### Promotion Forecasting

Predict:

- Sale probability
- Discount depth
- Promotion duration

instead of price alone.
