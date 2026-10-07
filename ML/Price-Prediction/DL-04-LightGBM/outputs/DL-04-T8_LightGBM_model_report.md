# DL-04-T8 LightGBM Model Report

## Purpose

Train and evaluate a LightGBM regression model for the DL-04 next-price forecasting task.

## Dataset

- Input rows: 33,098
- Training rows: 18,301
- Validation rows: 4,928
- Test rows: 9,869
- Products: 6,142
- Date range: 2024-03-05 10:06:57.773000+00:00 -> 2024-03-13 19:22:20.025000+00:00

## Model Setup

- Model: LightGBM regression
- Objective: regression L1
- Target: `target_next_price`
- Horizon: next available observation for the same product-retailer series
- Validation strategy: time-based train/validation/test split
- Main benchmark: `last_known_price`
- Selected variant: `lightgbm_residual_numeric_features`

## Selected LightGBM Results

| split | model | rows | mae | rmse | smape_percent | directional_accuracy |
| --- | --- | --- | --- | --- | --- | --- |
| train | lightgbm_regression | 18301 | 0.2762 | 1.5884 | 2.17 | 0.9362 |
| validation | lightgbm_regression | 4928 | 0.7885 | 2.1605 | 8.43 | 0.7423 |
| test | lightgbm_regression | 9869 | 0.5557 | 1.8442 | 5.8 | 0.7613 |

## LightGBM Variant Comparison

| split | model | rows | mae | rmse | smape_percent | directional_accuracy |
| --- | --- | --- | --- | --- | --- | --- |
| test | lightgbm_residual_all_features | 9869 | 0.5372 | 1.7936 | 5.68 | 0.7585 |
| test | lightgbm_residual_numeric_features | 9869 | 0.5557 | 1.8442 | 5.8 | 0.7613 |
| test | lightgbm_direct_all_features | 9869 | 2.8149 | 27.2794 | 5.98 | 0.4874 |
| test | lightgbm_direct_numeric_features | 9869 | 2.9357 | 27.8665 | 5.41 | 0.5062 |
| train | lightgbm_residual_all_features | 18301 | 0.275 | 1.5805 | 2.18 | 0.9345 |
| train | lightgbm_residual_numeric_features | 18301 | 0.2762 | 1.5884 | 2.17 | 0.9362 |
| train | lightgbm_direct_all_features | 18301 | 2.613 | 23.9578 | 6.82 | 0.5304 |
| train | lightgbm_direct_numeric_features | 18301 | 2.897 | 25.1939 | 7.33 | 0.5088 |
| validation | lightgbm_residual_numeric_features | 4928 | 0.7885 | 2.1605 | 8.43 | 0.7423 |
| validation | lightgbm_residual_all_features | 4928 | 0.7945 | 2.1572 | 8.51 | 0.7417 |
| validation | lightgbm_direct_all_features | 4928 | 1.7732 | 11.5925 | 12.79 | 0.4921 |
| validation | lightgbm_direct_numeric_features | 4928 | 1.8743 | 12.0075 | 12.78 | 0.5276 |

## Baseline And LightGBM Comparison

| split | model | rows | mae | rmse | smape_percent | directional_accuracy |
| --- | --- | --- | --- | --- | --- | --- |
| test | last_known_price | 9869 | 0.1406 | 1.2574 | 1.21 | 0.9671 |
| test | lightgbm_regression | 9869 | 0.5557 | 1.8442 | 5.8 | 0.7613 |
| train | lightgbm_regression | 18301 | 0.2762 | 1.5884 | 2.17 | 0.9362 |
| train | last_known_price | 18301 | 0.3735 | 1.9925 | 3.19 | 0.9073 |
| validation | lightgbm_regression | 4928 | 0.7885 | 2.1605 | 8.43 | 0.7423 |
| validation | last_known_price | 4928 | 0.9685 | 2.6076 | 10.93 | 0.6985 |

## Top Feature Importances

| model | feature | importance |
| --- | --- | --- |
| lightgbm_residual_numeric_features | discount_amount | 115 |
| lightgbm_residual_numeric_features | recorded_day_of_week | 109 |
| lightgbm_residual_numeric_features | unit_price | 93 |
| lightgbm_residual_numeric_features | price | 87 |
| lightgbm_residual_numeric_features | discount_percent | 47 |
| lightgbm_residual_numeric_features | unit_price_missing | 10 |
| lightgbm_residual_numeric_features | is_on_special | 9 |
| lightgbm_residual_numeric_features | recorded_day_of_month | 8 |
| lightgbm_residual_numeric_features | has_special_text | 2 |
| lightgbm_residual_numeric_features | recorded_month | 0 |
| lightgbm_residual_numeric_features | previous_price | 0 |
| lightgbm_residual_numeric_features | previous_unit_price | 0 |

## Test Comparison

- Last-known-price baseline test MAE: 0.1406
- LightGBM test MAE: 0.5557
- Difference: 0.4151

## Conclusion

LightGBM does not beat the last-known-price baseline on the test split. The persistence baseline remains difficult to beat on this dataset.

## Important Limitation

The current dataset contains only a limited number of historical snapshots. The next-price target represents the next available observation for each product-retailer series. Some products have sparse observations, so a simple last-known-price baseline can remain very strong.

## Generated Files

- `dl04_lightgbm_model.joblib`
- `dl04_lightgbm_predictions.csv`
- `dl04_lightgbm_results.csv`
- `dl04_lightgbm_variant_results.csv`
- `dl04_model_comparison.csv`
- `dl04_lightgbm_feature_importance.csv`
- `dl04_lightgbm_sample_predictions.json`
