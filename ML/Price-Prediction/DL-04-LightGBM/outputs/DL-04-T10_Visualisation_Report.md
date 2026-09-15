# DL-04-T10 Visualisation and Forecast Analysis Report

## Purpose

T10 provides the visual analysis layer for the DL-04 next-price forecasting
pipeline.

The analysis compares:

1. Last-known-price persistence baseline
2. LightGBM next-price forecast
3. Change-aware LightGBM forecast

The visualisation layer is designed to make model behaviour interpretable
rather than relying only on aggregate error metrics.

## Dataset

- Total prediction rows: 9,869
- Test rows: 9,869
- Products: 5,718
- Retailers: 1

## Test Performance

| Model | MAE | RMSE | Directional Accuracy |
| --- | ---: | ---: | ---: |
| Last-known-price baseline | 0.1406 | 1.2574 | 0.9671 |
| LightGBM | 0.5928 | 2.0696 | 0.7317 |
| Change-aware LightGBM | 0.5570 | 2.0610 | 0.8046 |

## Test Price-Change Distribution

- Actual price-change rows: 325
- Actual price-change rate: 3.29%

This is important because a persistence forecast can achieve very low
aggregate error when most observations retain the same price. Therefore,
T10 also examines error across price-change regimes, forecast horizons,
promotion states, and change probabilities.

## Horizon Analysis

| horizon_bucket   |   rows |   mean_horizon_days |   baseline_mae |   lightgbm_mae |   change_aware_mae |
|:-----------------|-------:|--------------------:|---------------:|---------------:|-------------------:|
| 0-1.05d          |   4376 |              1.0008 |         0.0049 |         0.4223 |             0.3805 |
| 1.05-1.50d       |   4155 |              1.1891 |         0.0006 |         0.4768 |             0.4381 |
| 1.50-2.50d       |    808 |              2.0894 |         0.633  |         1.4721 |             1.4589 |
| >2.50d           |    530 |              4.6834 |         1.6075 |         1.5693 |             1.571  |

## Price-Change Regime Analysis

| regime         |   rows |   baseline_mae |   lightgbm_mae |   change_aware_mae |
|:---------------|-------:|---------------:|---------------:|-------------------:|
| stable_price   |   9544 |         0      |         0.4844 |             0.447  |
| price_increase |    128 |         4.3238 |         3.0899 |             3.1107 |
| price_decrease |    197 |         4.2338 |         4.2226 |             4.2281 |

## Promotion Analysis

| regime        |   rows |   baseline_mae |   lightgbm_mae |   change_aware_mae |
|:--------------|-------:|---------------:|---------------:|-------------------:|
| non_promotion |   5273 |         0.1431 |         0.3343 |             0.3274 |
| promotion     |   4596 |         0.1377 |         0.8893 |             0.8204 |

## Change-Probability Analysis

| probability_bucket   |   rows |   mean_probability |   actual_change_rate |   mean_change_aware_mae |
|:---------------------|-------:|-------------------:|---------------------:|------------------------:|
| 0.0-0.1              |    772 |             0.0421 |               0.1801 |                  0.767  |
| 0.1-0.2              |   1264 |             0.153  |               0.0119 |                  0.0266 |
| 0.2-0.3              |   2072 |             0.2472 |               0.0121 |                  0.017  |
| 0.3-0.4              |   2635 |             0.3361 |               0.0171 |                  0.0385 |
| 0.4-0.5              |    572 |             0.4517 |               0.0367 |                  0.2286 |
| 0.5-0.6              |    482 |             0.5466 |               0.029  |                  0.111  |
| 0.6-0.7              |    808 |             0.6571 |               0.0384 |                  1.4393 |
| 0.7-0.8              |    905 |             0.7457 |               0.0287 |                  1.7173 |
| 0.8-0.9              |    349 |             0.8363 |               0.0201 |                  5.2166 |
| 0.9-1.0              |     10 |             0.9333 |               0.2    |                  1.2678 |

## Visual Outputs

The following plots are generated:

- Overall MAE comparison
- Overall RMSE comparison
- Forecast error by horizon
- Forecast error by price-change regime
- Forecast error by promotion regime
- Change-probability calibration
- Representative recent price trend
- Individual product forecast trends

## Interpretation

The T10 analysis deliberately avoids claiming that LightGBM is superior
solely because it performs better than the baseline in a particular
subgroup.

Aggregate performance and regime-specific performance are reported
separately.

This is particularly important for DL-04 because the test data contains
many stable-price observations. A model that predicts the current price
can therefore be extremely competitive on overall MAE.

The visualisation layer makes this behaviour transparent and provides
evidence for deciding whether a more advanced forecasting strategy is
useful for downstream DiscountMate functionality.

## Reproducibility

All figures are generated directly from the DL-04 training/prediction
artifacts and are saved under the configured output directory.
