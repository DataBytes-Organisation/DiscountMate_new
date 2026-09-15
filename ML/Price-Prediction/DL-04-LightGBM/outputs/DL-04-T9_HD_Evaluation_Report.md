# DL-04-T9 HD Evaluation Report

## Research Objective

Evaluate whether LightGBM provides predictive value beyond a last-known-price persistence baseline for next-price forecasting.

## Dataset

- Input rows: 33,098
- Products: 6,142
- Product-retailer series: 6,142
- Training rows: 18,301
- Validation rows: 4,928
- Test rows: 9,869

## Experimental Protocol

- Model selection uses validation MAE only.
- Test data is reserved for final evaluation.
- Persistence baseline predicts the current price.
- LightGBM predicts the next observed price.
- Residual modelling predicts price change relative to current price.

## Selected Model

- Selected variant: `lightgbm_residual_numeric_features`
- Selection metric: validation MAE
- Objective: LightGBM regression with L1 loss

## Aggregate Results

| split | model | rows | mae | rmse | smape_percent | directional_accuracy |
| --- | --- | --- | --- | --- | --- | --- |
| test | last_known_price | 9869 | 0.1406 | 1.2574 | 1.21 | 0.9671 |
| test | lightgbm_regression | 9869 | 0.5928 | 2.0696 | 5.84 | 0.7317 |
| train | lightgbm_regression | 18301 | 0.2515 | 1.4987 | 2.03 | 0.94 |
| train | last_known_price | 18301 | 0.3735 | 1.9925 | 3.19 | 0.9073 |
| validation | lightgbm_regression | 4928 | 0.765 | 2.1375 | 8.26 | 0.7376 |
| validation | last_known_price | 4928 | 0.9685 | 2.6076 | 10.93 | 0.6985 |

## Paired Test Comparison

| split | rows | baseline_mae | lightgbm_mae | ml_win_rate | baseline_win_rate | tie_rate | mean_mae_improvement |
| --- | --- | --- | --- | --- | --- | --- | --- |
| test | 9869 | 0.1406 | 0.5928 | 0.0089 | 0.3166 | 0.6744 | -0.4522 |

## Price-Change Regime Analysis

| regime | rows | baseline_mae | lightgbm_mae | ml_win_rate |
| --- | --- | --- | --- | --- |
| stable_price | 9544 | 0.0 | 0.4844 | 0.0 |
| price_changed | 325 | 4.2692 | 3.7765 | 0.2708 |
| price_increase | 128 | 4.3238 | 3.0899 | 0.5312 |
| price_decrease | 197 | 4.2338 | 4.2226 | 0.1015 |

## Promotion Regime Analysis

| regime | rows | baseline_mae | lightgbm_mae | ml_win_rate |
| --- | --- | --- | --- | --- |
| non_promotion | 5273 | 0.1431 | 0.3343 | 0.0025 |
| promotion | 4596 | 0.1377 | 0.8893 | 0.0163 |

## Forecast-Horizon Analysis

| horizon_bucket | rows | mean_horizon_days | baseline_mae | lightgbm_mae | ml_win_rate |
| --- | --- | --- | --- | --- | --- |
| 0-1.05d | 4376 | 1.0008 | 0.0049 | 0.4223 | 0.0007 |
| 1.05-1.50d | 4155 | 1.1891 | 0.0006 | 0.4768 | 0.0002 |
| 1.50-2.50d | 808 | 2.0894 | 0.633 | 1.4721 | 0.0631 |
| >2.50d | 530 | 4.6834 | 1.6075 | 1.5693 | 0.0623 |

## Blend Experiment

A simple convex blend was evaluated to determine whether combining persistence and ML can provide a more robust forecast.

| ml_weight | baseline_weight | rows | mae | rmse |
| --- | --- | --- | --- | --- |
| 0.0 | 1.0 | 9869.0 | 0.1406 | 1.2574 |
| 0.1 | 0.9 | 9869.0 | 0.1858 | 1.2576 |
| 0.2 | 0.8 | 9869.0 | 0.231 | 1.2814 |
| 0.3 | 0.7 | 9869.0 | 0.2763 | 1.3276 |
| 0.4 | 0.6 | 9869.0 | 0.3215 | 1.3938 |
| 0.5 | 0.5 | 9869.0 | 0.3667 | 1.4775 |
| 0.6 | 0.4 | 9869.0 | 0.4119 | 1.5758 |
| 0.7 | 0.3 | 9869.0 | 0.4571 | 1.6862 |
| 0.8 | 0.2 | 9869.0 | 0.5024 | 1.8065 |
| 0.9 | 0.1 | 9869.0 | 0.5476 | 1.9348 |
| 1.0 | 0.0 | 9869.0 | 0.5928 | 2.0696 |

- Best ML blend weight: `0.00`

## Feature Importance

| model | feature | importance |
| --- | --- | --- |
| lightgbm_residual_numeric_features | discount_amount | 554 |
| lightgbm_residual_numeric_features | price | 508 |
| lightgbm_residual_numeric_features | unit_price | 503 |
| lightgbm_residual_numeric_features | discount_percent | 205 |
| lightgbm_residual_numeric_features | recorded_day_of_week | 205 |
| lightgbm_residual_numeric_features | is_on_special | 68 |
| lightgbm_residual_numeric_features | unit_price_missing | 20 |
| lightgbm_residual_numeric_features | recorded_day_of_month | 17 |
| lightgbm_residual_numeric_features | has_special_text | 11 |
| lightgbm_residual_numeric_features | previous_price | 7 |
| lightgbm_residual_numeric_features | days_since_previous_observation | 2 |
| lightgbm_residual_numeric_features | recorded_month | 0 |
| lightgbm_residual_numeric_features | previous_unit_price | 0 |
| lightgbm_residual_numeric_features | previous_is_on_special | 0 |
| lightgbm_residual_numeric_features | previous_price_change | 0 |

## Test Interpretation

- Persistence test MAE: `0.1406`
- LightGBM test MAE: `0.5928`
- LightGBM minus baseline MAE: `0.4522`

LightGBM did not outperform the persistence baseline on aggregate test MAE. This does not mean the model has no value: the HD evaluation examines whether ML provides value specifically during price changes, promotions, and different forecast horizons.

## HD-Level Contribution

The contribution is not based solely on attempting to minimise aggregate MAE. The evaluation explicitly tests where machine learning is useful: changed-price regimes, price increases, price decreases, promotional observations, and different forecast horizons. This provides a more defensible assessment of whether a learned model adds value over persistence.

## Limitations

The dataset contains only a limited historical period and observations are sparse for some products. Consequently, persistence is a strong benchmark and generalisation to longer historical periods should be validated when additional snapshots become available.

## Generated Outputs

- `dl04_lightgbm_model.joblib`
- `dl04_lightgbm_predictions.csv`
- `dl04_lightgbm_results.csv`
- `dl04_lightgbm_variant_results.csv`
- `dl04_model_comparison.csv`
- `dl04_lightgbm_feature_importance.csv`
- `dl04_lightgbm_sample_predictions.json`
- `dl04_hd_paired_comparison.csv`
- `dl04_hd_regime_analysis.csv`
- `dl04_hd_promotion_analysis.csv`
- `dl04_hd_horizon_analysis.csv`
- `dl04_hd_blend_analysis.csv`
