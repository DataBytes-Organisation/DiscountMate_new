# DL-04-T9 Change-Aware Forecasting Evaluation

## Objective

Evaluate whether LightGBM should replace the persistence baseline or be selectively applied when a price change is likely.

## Dataset

- Rows: 33,098
- Test rows: 9,869
- Products: 6,142
- Target: next observed product price
- Price-change threshold: 0.05

## Architecture

The proposed adaptive forecasting strategy is:

1. Predict whether the next price will change.
2. If stable is predicted, use the current price.
3. If change is predicted, use the LightGBM forecast.

## Threshold Selection

The change-detection threshold was selected using the validation set only.

- Selected threshold: 0.65
- Validation hybrid MAE: 0.7566

## Test Change Detection

- Accuracy: 0.7951
- Precision: 0.0346
- Recall: 0.1938
- F1: 0.0587
- Actual change rate: 0.0329
- Predicted change rate: 0.1847

## Forecast Comparison

| model                 |   rows |    mae |   rmse |   smape_percent |   directional_accuracy |
|:----------------------|-------:|-------:|-------:|----------------:|-----------------------:|
| last_known_price      |   9869 | 0.1406 | 1.2574 |            1.21 |                 0.9671 |
| lightgbm              |   9869 | 0.5928 | 2.0696 |            5.84 |                 0.7317 |
| change_aware_lightgbm |   9869 | 0.557  | 2.061  |            5.41 |                 0.8046 |

## Regime Analysis

| regime         |   rows |   baseline_mae |   lightgbm_mae |   change_aware_mae |
|:---------------|-------:|---------------:|---------------:|-------------------:|
| stable_price   |   9544 |         0      |         0.4844 |             0.447  |
| price_changed  |    325 |         4.2692 |         3.7765 |             3.788  |
| price_increase |    128 |         4.3238 |         3.0899 |             3.1107 |
| price_decrease |    197 |         4.2338 |         4.2226 |             4.2281 |
| promotion      |   4596 |         0.1377 |         0.8893 |             0.8204 |
| non_promotion  |   5273 |         0.1431 |         0.3343 |             0.3274 |

## Price-Change Analysis

| regime         |   rows |    mae |   rmse |   smape_percent |   directional_accuracy |
|:---------------|-------:|-------:|-------:|----------------:|-----------------------:|
| stable         |   9544 | 0.447  | 1.7197 |            4.51 |                 0.8269 |
| changed        |    325 | 3.788  | 6.4914 |           31.85 |                 0.1508 |
| price_increase |    128 | 3.1107 | 5.53   |           24.61 |                 0.3359 |
| price_decrease |    197 | 4.2281 | 7.0461 |           36.55 |                 0.0305 |

## Top Change-Detector Features

| feature                         |   importance |
|:--------------------------------|-------------:|
| price                           |          581 |
| unit_price                      |          492 |
| discount_amount                 |          191 |
| is_on_special                   |           96 |
| previous_price                  |           91 |
| recorded_day_of_week            |           85 |
| discount_percent                |           62 |
| previous_unit_price             |           27 |
| has_special_text                |           15 |
| days_since_previous_observation |           12 |
| unit_price_missing              |           11 |
| previous_price_change_pct       |            9 |

## Conclusion

The change-aware architecture did not outperform persistence on aggregate test MAE. However, the experiment provides evidence about where ML forecasts are useful and where persistence remains preferable.

## Research Contribution

The experiment evaluates a practical adaptive forecasting architecture rather than assuming that a complex ML model should always replace a strong persistence baseline. This is particularly relevant for retail price data where most observations can remain unchanged while a smaller number of promotion-driven or other price-change events require different treatment.

## Generated Files

- `dl04_change_threshold_analysis.csv`
- `dl04_change_detector_metrics.json`
- `dl04_change_detector_confusion_matrix.csv`
- `dl04_change_aware_predictions.csv`
- `dl04_change_aware_comparison.csv`
- `dl04_change_aware_regime_analysis.csv`
- `dl04_change_aware_price_change_analysis.csv`
- `dl04_change_detector_feature_importance.csv`
- `dl04_change_detector.joblib`
