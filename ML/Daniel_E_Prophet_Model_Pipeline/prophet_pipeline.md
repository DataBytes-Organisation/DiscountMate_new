# Prophet Weekly Price Forecasting Pipeline

**Technical Documentation**

---

## Overview

This pipeline ingests weekly scraped price data, detects promotional patterns per SKU, and trains a Prophet model to forecast a number of weeks in advance. It has been designed to run as a Jenkins job.

| Inputs | Outputs |
|--------|---------|
| All CSV files in `DATA_PATH` directory | `weekly_predictions.csv` in `OUTPUT_PATH` |
| Columns used: `Timestamp`, `Stockcode`, `Name`, `Price`, `IsOnSpecial` | One row per SKU per forecast week (5 rows x N SKUs) |

---

## Configuration

All settings live in the `CONFIG` dictionary at the top of the `.py` file. Two paths are also read from environment variables so that Jenkins can override them without altering the source code.

| Parameter | Default | Action |
|-----------|---------|--------|
| `DATA_PATH` (env) | `/Woolworths` | Directory containing raw CSV files |
| `OUTPUT_PATH` (env) | `~/prophet_predictions/` | Where `weekly_predictions.csv` is written |
| `TARGET_SKUS` | `[722, 6022833, 196774, 25, 320104]` | List of Stockcodes to forecast |
| `MIN_OBSERVATIONS` | `8` | Minimum weekly rows required to attempt modelling |
| `TEST_WEEKS` | `3` | Held-out weeks used to evaluate model accuracy |
| `FORECAST_WEEKS` | `5` | How many future weeks to predict |
| `seasonality_prior_scale` | `[0.1, 1.0, 10.0]` | Grid of Prophet seasonality regularisation values |
| `regressor_prior_scale` | `[0.1, 0.5, 2.0, 5.0, 20.0, 50.0]` | Grid of promotional regressor regularisation values |

To override the paths in Jenkins, set `DATA_PATH` and `OUTPUT_PATH` in Jenkins' environment variables settings before the job runs. The script will pick them up automatically and no code changes will be needed.

---

## Pipeline Stages

### 1. Data Loading

The pipeline begins by reading all `.csv` files in `DATA_PATH` and concatenating them into a single dataframe. Files are assumed to share the same schema. Missing or empty directories raise an error immediately.

### 2. Weekly Aggregation

Raw data is timestamped at the scrape frequency. This stage collapses it to one row per SKU per week. The aggregation follows these rules:

- **Price:** takes the recorded price of the week.
- **IsOnSpecial:** set to `1` if the product was on special for the week, otherwise `0`.

Weeks with no data for a SKU are left as gaps instead of being interpolated. Prophet handles irregular time series natively.

### 3. Promotional Pattern Detection

Before modelling, the pipeline analyses each SKU's historical promotions to understand the pattern and rhythm it follows. This feeds the future promotional schedule that Prophet uses as a regressor.

| Output | What it means |
|--------|---------------|
| `avg_interval` | Average number of non-promotional weeks between promotions |
| `avg_duration` | Average length of a promotion (in weeks) |
| `promo_probability` | Fraction of all weeks the product was on special |
| `pattern_quality` | `good` / `irregular` / `insufficient_data` / `no_promotions` |
| `price_volatility` | Coefficient of variation of regular (non-promotional) prices |

**Pattern quality flags:**

- **good:** At least 2 promotions detected with consistent spacing (CV < 0.5).
- **irregular:** Promotions exist but timing is inconsistent. Forecasted promotional schedule will be less reliable.
- **insufficient_data:** Fewer than 2 promotions in history. Promotional regressor will have low signal.
- **no_promotions:** No promotional history detected. The model is trained without the promotional regressor and forecasts regular price only.

### 4. Model Training (Grid Search)

The model is configured with flat growth (to eliminate prices creeping upward long-term) and no built-in seasonality (as current data is limited). The only signal sources are:

- The historical price level (captured by the flat trend).
- `is_on_special`: a binary regressor indicating promotional weeks.

A 3x6 grid search (18 combinations) is conducted over `seasonality_prior_scale` and `regressor_prior_scale`. Each combination is trained on all weeks except the final `TEST_WEEKS`, then evaluated on those held-out weeks. The combination with the lowest MAPE on the test set is selected. Both MAE and MAPE are reported — MAPE is used for model selection as it scales correctly across cheap and expensive products; MAE is reported for dollar-term context.

If all 18 combinations fail, the SKU is skipped and logged as failed. Note: SKUs with no promotional history are handled separately — they run only 3 combinations without the promotional regressor and will not fail on this basis alone.

### 5. Future Promotional Schedule

The best model then needs a future dataframe to predict into. Since `IsOnSpecial` is unknown for future weeks, the pipeline generates a probabilistic schedule based on the detected pattern:

- Starting from the most recent data point, it projects forward `FORECAST_WEEKS` weeks.
- Promotion start timing = `avg_interval` weeks after the last promotion ended.
- Promotion duration = `avg_duration` weeks.
- If the last week was on special, the first forecast promo starts later (assumes current promo continues).

:::note
This is an approximation. Actual promotional scheduling is not available in advance, so `is_on_special` in the forecast is an informed estimate only, not ground truth.
:::

### 6. Prediction Output

The best model generates a 5-week forecast. Output columns per prediction row:

| Column | Description |
|--------|-------------|
| `Date` | Week start date |
| `Predicted_Price` | Point estimate, rounded to 2 decimal places |
| `Lower_Bound` | 80% credible interval lower bound (Prophet default) |
| `Upper_Bound` | 80% credible interval upper bound |
| `Predicted_OnSpecial` | `0` or `1` — whether this week was modelled as a sale week |
| `Price_Tier` | Product price classification: `low` (under $5), `mid` ($5–$20), `high` (over $20) |
| `Stockcode` | SKU identifier |
| `Product_Name` | Product name from raw data |
| `Retailer` | Hardcoded to `Woolworths` |

---

## What to Expect When Running

### Console Output

The pipeline is designed to be verbose so the user can follow the process as it runs. For each SKU, you will see:

```
[2/5] SKU: 6022833
Data: 24 weeks
  Training data shape: (21, 3)
  Training date range: 2025-01-06 to 2025-05-26
  Training y values: min=3.50, max=5.00
  Has promotions: True
  Special flag distribution: {0: 16, 1: 5}
  Grid search: 18 combinations
✓ Success — MAPE: 3.4%  MAE: $0.25  Tier: mid
```

Failed SKUs will also print a reason. Common causes:

- **No data found:** Stockcode not present in any of the CSV files.
- **Not enough data:** Fewer data points than `MIN_OBSERVATIONS` weeks after aggregation.
- **All grid-search combinations failed:** The price series has zero or near-zero variance (the product never changed price). SKUs with no promotional history are handled separately and will not fail on this basis.

### Typical Accuracy

Model selection uses MAPE so that errors are evaluated relative to price — a $0.50 error means something very different on a $2 product versus a $40 product. MAE is reported alongside for dollar-term context.

| Product Type | Typical MAPE | Typical MAE | Notes |
|---|---|---|---|
| Stable price, occasional promo | 1–5% | $0.05–$0.25 | Best case. Model learns promo discount reliably. |
| Frequently changing price | 8–15% | $0.30–$0.80 | Harder to fit. |
| Rarely on special | 3–8% | $0.10–$0.40 | Promotional regressor adds little; flat trend dominates. |
| Very few observations (<12 weeks) | 15%+ | $0.50+ | Small training set degrades confidence intervals. |

### Output File

`weekly_predictions.csv` is written to `OUTPUT_PATH`. It contains all successful SKUs concatenated. If no SKUs succeed, the file is not written and an error is printed. The file is not committed to git — it is archived as a Jenkins build artifact and accessible from the Jenkins UI.

---

## Known Limitations

- **No external regressors:** Only `IsOnSpecial` is used. Competitor pricing, seasonality, and catalogue events are not modelled.
- **Promotional schedule is estimated:** The future promotion flag is generated from historical patterns. If Woolworths changes its promotional cadence, the forecast will be inaccurate.
- **Flat growth assumption:** Prices are assumed to be mean-reverting with no long-term drift. If a product has been systematically repriced over time, this will underfit.
- **No weekly seasonality:** Prophet's built-in weekly/yearly seasonality is disabled. This is correct for retail price data, but removes a safety net if data has unexpected periodicity.
- **Limited data:** Data across the investigated supermarkets is collected following different structures. This Prophet model is trained specifically on data obtained from Woolworths' scrapers as it was the most complete at the time of the model's development.
- **First price of the week:** Aggregation takes the first recorded price. If scraping runs at irregular hours or is missing at the pipeline's scheduled runtime, this could introduce noise or inaccuracies.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `prophet` | Core forecasting model (Facebook/Meta Prophet) |
| `pandas` | Data loading, aggregation, and output |
| `numpy` | Array operations and statistical calculations |
| `scikit-learn` | MAE, RMSE, MAPE calculation via `sklearn.metrics` |
| `pathlib` / `os` | Cross-platform path handling and env var reading |

```bash
pip install prophet pandas numpy scikit-learn
```

Prophet requires `pystan` or `cmdstan` as a backend. On first install, run a test fit to confirm the C++ toolchain is working. Prophet installation failures are the most common setup issue.

---

## Jenkins Setup

The pipeline reads `DATA_PATH` and `OUTPUT_PATH` from environment variables. The Jenkinsfile sets these automatically from the workspace:

```groovy
pipeline {
    ...
    environment {
        DATA_PATH   = "${WORKSPACE}/data"
        OUTPUT_PATH = "${WORKSPACE}/predictions"
        VENV_PATH   = "${WORKSPACE}/.venv"
    }
}
```

- A persistent virtualenv is created on the first run and reused on subsequent runs — dependencies only reinstall when `requirements.txt` changes.
- A 30-minute timeout is set. If Prophet hangs on a SKU, Jenkins will abort the job and mark it as failed.
- Predictions are archived as a build artifact in Jenkins and are not committed to git.
- Exit code `0` means the pipeline ran, check the summary for per-SKU failures. A non-zero exit code means a top-level exception, most likely a missing data directory or import error.

## Opportunities for Future Development

- **Promotional depth forecasting:** The current model predicts *whether* a product will be on
  sale, but not *how deep* the discount will be. Future teams could model the sale price itself
  as a continuous variable, for example, predicting a 30% discount in week 3 followed by a
  50% discount in week 4 before returning to regular price. This would require enough
  historical promotional depth data per SKU to train reliably.

- **Monthly trend detection:** As the dataset grows, patterns such as end-of-month promotions
  or monthly catalogue cycles may become detectable. Prophet supports custom seasonality
  components, so a monthly regressor could be added once sufficient data exists to identify
  these rhythms with confidence.

- **Optimised Data Pathways:** The current model draws data from localised storage,
  in its current setup, Git. However, data is now stored/kept in GCP. The pipeline
  can be updated to pull data from there. Additionally, the current output is a
  CSV file, however, the web platform will need to pull this somehow. A way to 
  write to the GCP (and also overwrite eventually) will need to be set up.

- **Pipeline Polling:** The pipeline will poll the data pathway Mondays at 2AM,
  but this will need to be updated when a consistent data scrpaing timeline
  is put in place. This reduces the load required to keep polling when nothing
  is being updated.

- **More Products:** Grid search currently operates on predefined SKUs defined
  by the pipeline. Models should be trained and tested across all products,
  or at least batches of products. Doing live training and testing will waste
  the user's time, so a way to have all products ready for users to check
  whenever they need will be useful. Potenitally could train on user's 
  frequent searches, but this may be ineffient across all users.

- **External regressors:** External economic factors such as fuel prices could be 
  incorporated as additional regressors. This would be particularly relevant
  for products sensitive to input costs. The feasibility depends on sourcing reliable,
  consistently updated external data feeds. However, this is likely out of scope.

- **Cross-retailer comparison:** Forecasting the same SKU (or equivalent product) across
  multiple retailers and comparing predicted prices on a single view. 
  This was out of scope for the current pipeline due to differing data structures
  across retailers, but is a natural extension once data collection is standardised.