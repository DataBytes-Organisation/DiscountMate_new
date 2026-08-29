# DL-04-T11 Standardised Prediction Output Report

## Purpose

T11 standardises DL-04 forecasting results into a machine-readable
prediction contract suitable for downstream DiscountMate components.

## Output

- Prediction JSON: `dl04_t11_predictions.json`
- JSON Schema: `dl04_t11_prediction_schema.json`
- Schema version: `1.0.0`

## Dataset

- Prediction rows: 9,869
- Products: 5,718
- Test rows: 9,869
- Retailers: 1

## Prediction Contract

Each prediction contains:

1. Product and retailer identity
2. Observation timestamp
3. Current observed price
4. Forecast horizon
5. Persistence baseline
6. Raw LightGBM forecast
7. Change-aware forecast
8. Selected forecast
9. Change probability
10. Predicted price-change class
11. Change and promotion regimes
12. Model metadata
13. Evaluation metadata

## Validation

| Check | Result |
| --- | --- |
| `required_columns_present` | PASS |
| `non_empty_dataset` | PASS |
| `product_id_not_null` | PASS |
| `retailer_id_not_null` | PASS |
| `baseline_prediction_not_null` | PASS |
| `lightgbm_prediction_not_null` | PASS |
| `change_aware_prediction_not_null` | PASS |
| `change_probability_valid` | PASS |
| `predicted_change_class_valid` | PASS |
| `forecast_horizon_positive` | PASS |
| `target_timestamp_after_observation` | PASS |
| `unique_prediction_keys` | PASS |
| `valid_split_labels` | PASS |

## Validation Summary

- Checks passed: 0/8
- Overall validation: PASS

## Design Decision

The `change_aware_lightgbm` forecast is exposed as the selected prediction
because T9 established it as the final change-aware forecasting strategy.

The persistence baseline and raw LightGBM prediction are retained so that
downstream consumers and evaluators can compare the selected forecast
against the established benchmark.

## Important Interpretation

`change_probability` represents the output of the change detector. It should
not automatically be interpreted as a calibrated probability of a price
change until calibration has been separately validated.

## Reproducibility

The prediction identifier is deterministically generated from:

- product ID
- retailer ID
- observation timestamp

This allows a prediction record to be traced back to its source observation.

