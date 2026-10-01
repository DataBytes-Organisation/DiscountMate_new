# DL-04 Price Forecasting and Model Governance

## Overview

This module extends the DiscountMate price forecasting pipeline with:

- LSTM-based sequential price forecasting
- baseline-aware model evaluation
- model performance comparison
- feature and prediction drift monitoring
- automated model governance decisions

The objective is not only to train a predictive model, but to determine whether a model provides sufficient evidence to replace the existing persistence baseline.

---

## Problem

Price forecasting models can achieve reasonable predictive performance while still performing worse than a simple last-known-price baseline.

For DiscountMate, model selection therefore needs to consider:

1. predictive accuracy
2. directional accuracy
3. comparison against a simple baseline
4. temporal/data drift
5. deployment risk

This module provides an evidence-based governance process for these decisions.

---

## Dataset

The DL-04 training dataset contains historical product price observations.

The current processed dataset contains:

- 33,098 records
- 29 columns
- train: 18,301 records
- validation: 4,928 records
- test: 9,869 records

The LSTM sequence generation uses chronological product histories and a sequence length of 3.

---

## LSTM Experiment

The LSTM model uses:

- sequence length: 3
- input features: 17
- LSTM units: 64
- dropout: 0.2
- dense layer: 32 units
- output: predicted next price
- optimizer: Adam
- learning rate: 0.001
- loss: Mean Squared Error
- early stopping

The model was trained for a maximum of 100 epochs with early stopping.

The best validation performance was restored from epoch 23.

### LSTM test results

| Metric | Result |
|---|---:|
| MAE | 4.0166 |
| RMSE | 9.6788 |
| Test samples | 8,876 |

The LSTM experiment is retained as a sequential modelling benchmark rather than the production model.

---

## Baseline Comparison

The persistence baseline predicts that the next price will equal the current/last known price.

Current test results:

| Model | MAE | RMSE | sMAPE | Directional Accuracy |
|---|---:|---:|---:|---:|
| Last-known-price baseline | 0.1406 | 1.2574 | 1.21% | 96.71% |
| LightGBM regression | 0.5928 | 2.0696 | 5.84% | 73.17% |
| Change-aware LightGBM | 0.5570 | 2.0610 | 5.41% | 80.46% |

The persistence baseline currently performs better on the primary error metrics.

Therefore, the governance layer does not recommend replacing the baseline.

---

## Model Governance

`dl04_model_governance.py` evaluates candidate models against the persistence baseline.

The governance process:

1. loads model evaluation results
2. identifies the persistence baseline
3. compares candidate models against the baseline
4. calculates relative MAE change
5. loads drift-monitoring results
6. summarises PSI and KS alerts
7. produces a final governance decision

### Current decision

```text
Selected model: last_known_price
Governance status: review_required
Drift status: critical
PSI critical alerts: 5
KS critical alerts: 3
PSI warnings: 1
KS warnings: 4