# Discount Price Prediction

This folder contains an experimental two-stage workflow for predicting whether a catalogue product will be on special in the following week and estimating its discounted price.

The workflow has three parts:

1. Clean the OCR-derived catalogue data and construct weekly product histories.
2. Compare classification models for next-week special detection.
3. Compare regression models for discount depth and combine both predictions into an estimated special price.

## Files

| File | Purpose |
| --- | --- |
| `all_catalogue_products.csv` | Local source data extracted from catalogues. This file is not committed. |
| `discount_price_dataset_preparation.ipynb` | Cleans the source data, builds weekly histories and creates modelling targets. |
| `discount_price_final_dataset.csv` | Generated modelling dataset. This file is not committed. |
| `discount_special_model_comparison.ipynb` | Compares models that predict whether a product will be on special next week. |
| `discount_price_regression_and_prediction.ipynb` | Compares discount regressors and builds the combined price predictor. |
| `discount_special_model.joblib` | Generated standalone classification model. This file is not committed. |
| `discount_price_prediction_model.joblib` | Generated combined classification and regression model. This file is not committed. |
| `all_catalogue_products2024.csv` | Local 2024 catalogue source. Only `VIC METRO` rows are used. |
| `discount_price_combined_dataset_preparation.ipynb` | Creates a separate VIC Metro dataset from the 2024 and 2025 source files. |
| `combined_data_model_training_comparison.ipynb` | Loads both datasets, creates chronological splits, trains the existing models and LSTM models, and compares their results. |
| `discount_price_combined_2024_2025_vic.csv` | Generated combined modelling dataset. This file is not committed. |
| `discount_price_prediction_model_combined.joblib` | Generated combined-data tabular model. This file is not committed. |
| `discount_special_lstm_combined.keras` | Generated combined-data LSTM classifier. This file is not committed. |
| `discount_price_lstm_combined.keras` | Generated combined-data LSTM discount regressor. This file is not committed. |

CSV, Joblib and Keras files are excluded by the repository's Git ignore rules. The source CSV files must be supplied locally before running the notebooks.

## Setup

From the repository root:

```bash
python3 -m venv .myenv
source .myenv/bin/activate
python -m pip install --upgrade pip
python -m pip install pandas numpy matplotlib scikit-learn xgboost jupyter ipykernel joblib tensorflow
jupyter notebook
```

Run the notebooks in this order:

1. `discount_price_dataset_preparation.ipynb`
2. `discount_special_model_comparison.ipynb`
3. `discount_price_regression_and_prediction.ipynb`

The notebooks can be run either from this folder or from the repository root.

For the new combined experiment, keep the original 2025 files unchanged and run:

1. `discount_price_combined_dataset_preparation.ipynb`
2. `combined_data_model_training_comparison.ipynb`

Both `all_catalogue_products.csv` and `all_catalogue_products2024.csv` must be in this folder. Use a Python 3.10–3.12 notebook kernel; the notebook installs TensorFlow and the other required packages into the selected kernel.

## Combined VIC Metro experiment

The separate combined preprocessing notebook applies the same cleaning, product matching, weekly history, target and feature logic to both source files. It filters the inputs to `VIC METRO` before combining them and does not overwrite the existing 2025 dataset or models.

| Check | Combined result |
| --- | ---: |
| 2024 VIC source rows | 4,675 |
| 2025 VIC source rows | 15,195 |
| Date range | 11 Sep 2024–31 Dec 2025 |
| Products retained | 8,508 |
| Final product-week rows | 59,539 |
| Classification-eligible rows | 58,748 |
| Next-week special examples | 5,430 |
| Discount-regression examples | 3,043 |

The comparison uses the same validation dates (9 September–4 November 2025) and test start date (5 November 2025) for both datasets. This keeps the evaluation period identical; the only difference is the earlier training history.

### Best validation-selected results

| Task and training data | Selected model | Test precision | Test recall | Test F1 | Test PR-AUC | Test MAE |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Special classification, 2025 only | LSTM | 24.32% | 26.98% | 25.58% | 21.67% | — |
| Special classification, combined | LSTM | 20.16% | 46.28% | 28.09% | 22.16% | — |
| Discount regression, 2025 only | HistGradientBoosting | — | — | — | — | 9.00 points |
| Discount regression, combined | HistGradientBoosting | — | — | — | — | 8.46 points |

The combined LSTM improves recall, F1 and PR-AUC, although its precision is lower. The combined HistGradientBoosting regressor improves test MAE from approximately 9.14 to 8.46 percentage points.

LSTM inputs use four consecutive weeks from the same product only. Missing-value handling and scaling are fitted on training rows, and the test period is not used for early stopping or threshold selection.

The model notebook saves the best validation-selected combined tabular classifier and regressor in `discount_price_prediction_model_combined.joblib`. Its final test section reloads that file and scores three reproducible random products, showing special probability, rounded discount, predicted special price and probability-weighted expected price.

## Dataset preparation

### Product and date cleaning

- Converts `catalogue_start_date` to a datetime value.
- Converts extracted price, discount, OCR confidence and evidence fields to numeric values.
- Keeps the original product name for reference.
- Creates a lowercase canonical product name.
- Normalises common expressions such as Coca-Cola, kilograms, grams, millilitres and litres.
- Removes names that do not contain at least three alphabetic characters.
- Creates a product identifier from the canonical product name.
- Removes duplicate retailer, region, product and catalogue-week records, retaining the most trustworthy candidate.

### Price validation

A special price is treated as trustworthy when:

- Its source is `displayed_price` or `save_was_arithmetic`.
- The row is verified or supported by at least two pieces of evidence.
- OCR confidence is at least 85.
- The special price is between $0.01 and $2,000.

When possible, a missing regular price is calculated as:

```text
regular price = special price + save amount
```

Regular prices are rejected when they are outside the accepted range, below the special price or imply a discount outside 0% to 80%.

### Weekly history

The notebook creates a weekly calendar for every valid product. A trustworthy regular price can be carried forward for a maximum of eight catalogue weeks. Each price records whether its source was:

- `observed`
- `calculated`
- `forward_filled`
- `missing`

An observed promotion with `half_price`, `save_amount` or `special` is labelled as a special. Discount values are recalculated from the cleaned prices:

```text
discount percentage = (regular price - special price) / regular price * 100
```

### Features

The generated dataset includes:

- Current effective and regular prices.
- Price trust and inference indicators.
- Price lags for one, two and four weeks.
- Previous discount information.
- Four-week and eight-week average prices.
- Four-week and eight-week promotion frequency.
- Weeks since the last special.
- Weeks since the last observed regular price.
- Product history count and cold-start indicator.
- Week of year, month, quarter and Australian season.
- Current promotion type and regular-price source.

### Targets

The workflow creates two next-week targets:

- `target_is_special_next_week`: whether the product appears as a special in the next catalogue week.
- `target_discount_percent_next_week`: the trustworthy discount percentage when the following week is a special.

It also creates separate eligibility flags:

- `classification_eligible`
- `discount_regression_eligible`

All valid products are retained, including cold-start products with limited history.

## Prepared dataset results

| Check | Result |
| --- | ---: |
| Source rows | 15,195 |
| Duplicate rows removed | 115 |
| Trustworthy prices | 7,286 |
| Products retained | 6,784 |
| Final product-week rows | 45,431 |
| Classification-eligible rows | 44,640 |
| Next-week special examples | 4,192 |
| Discount-regression examples | 2,376 |

Validation checks confirm that:

- No duplicate product-week records remain.
- Forward-filled regular prices are limited to eight weeks.
- Classification targets are present for eligible rows.
- Regression targets only represent specials.
- Trustworthy discount targets remain between 0% and 80%.

## Special classification

The classification notebook uses a chronological split:

| Split | Rows |
| --- | ---: |
| Training | 30,511 |
| Validation | 7,435 |
| Test | 6,694 |

Because only about 9% of eligible rows are specials, the models use class weighting. Each probability threshold is selected on the validation period using F1 score.

### Classification comparison

| Model | Accuracy | Balanced accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Logistic Regression | 77.02% | 62.84% | 18.53% | 45.53% | 26.34% | 67.01% | 18.53% |
| XGBoost | 83.70% | 57.93% | 19.83% | 26.49% | 22.68% | 65.94% | 18.16% |
| HistGradientBoosting | 83.27% | 59.19% | 20.55% | 29.80% | 24.32% | 65.86% | 17.96% |
| Random Forest | 77.88% | 58.76% | 16.40% | 35.43% | 22.42% | 63.57% | 16.45% |

Logistic Regression is selected using PR-AUC and F1. Its validation-selected threshold is approximately 0.688. It detects about 46 of every 100 test specials, but only about 19 of every 100 positive predictions are correct.

Accuracy should not be used alone: predicting every row as non-special would achieve approximately 91% accuracy because the dataset is highly imbalanced.

After evaluation, the selected classifier is retrained on all 44,640 eligible rows.

## Discount regression

The regression stage only uses rows where the next week contains a trustworthy observed discount.

| Split | Rows |
| --- | ---: |
| Training | 1,670 |
| Validation | 430 |
| Test | 276 |

### Regression comparison

| Model | Validation MAE | Test MAE | Test RMSE | Test R² |
| --- | ---: | ---: | ---: | ---: |
| HistGradientBoosting | 8.015 | 9.139 | 11.267 | 0.347 |
| Random Forest | 8.264 | 9.391 | 11.291 | 0.344 |
| Extra Trees | 8.308 | 9.716 | 11.764 | 0.288 |
| XGBoost | 8.409 | 9.369 | 11.121 | 0.364 |
| Neural Network (MLP) | 10.450 | 11.548 | 13.761 | 0.025 |
| Ridge Regression | 10.915 | 11.842 | 13.516 | 0.060 |
| Median baseline | 11.626 | 12.027 | 14.069 | -0.019 |

HistGradientBoosting is selected because it has the lowest validation MAE. Its test MAE of 9.139 means that its discount estimate differs from the actual discount by approximately 9.1 percentage points on average.

After evaluation, the selected regressor is retrained on all 2,376 trustworthy discounted rows.

## Combined prediction

The final workflow produces:

- `special_probability`
- `predicted_is_special`
- `predicted_discount_percent_if_special`
- `predicted_special_price_if_special`
- `probability_weighted_expected_price`

Discount predictions are rounded to the nearest 5 percentage points. For example, a raw prediction of 47.4% becomes 45%.

The conditional special price is calculated as:

```text
predicted special price = regular price * (1 - predicted discount / 100)
```

The probability-weighted price is calculated as:

```text
expected price = regular price * (1 - special probability * predicted discount / 100)
```

To make predictions inside the final notebook, pass prepared product rows to:

```python
predictions = predict_next_week_offer(product_rows)
```

An exact dollar prediction is unavailable when the product does not have a usable regular-price reference.

## Limitations

- The source data covers only one calendar year, so the models cannot learn genuine year-over-year behaviour.
- A product missing from the following catalogue is currently treated as not being on special. This is an assumption, not a confirmed shelf-price observation.
- Product matching is based on cleaned catalogue names, which may represent grouped products rather than an exact flavour or SKU.
- Product IDs are generated during preparation and are not guaranteed to remain stable if source-row ordering changes.
- The classification problem is highly imbalanced and currently has low precision and recall.
- The regression model has only 2,376 trustworthy discounted examples.
- The expected-price calculation assumes the current regular-price reference remains valid next week.
- Classifier probabilities have not yet been calibrated, so probability-weighted prices should be treated as experimental.
- Joblib model files are dependent on Python and library versions. Regenerate them in the environment where they will be used.

These results establish a reproducible baseline. More recent catalogues, multiple years of history, better SKU matching and confirmed non-special shelf prices are required before production use.
