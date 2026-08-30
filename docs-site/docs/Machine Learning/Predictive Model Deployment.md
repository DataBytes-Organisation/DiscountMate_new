---
title: "Predictive Model Deployment — Live Inference vs Batch Pre-compute"
sidebar_label: "Predictive Model Deployment"
sidebar_position: 2
---

# Predictive Model Deployment — Live Inference vs Batch Pre-compute

:::info

For more resources on ML deployment see the shared resources loaded to the following location within sharepoint/TEAMS:

`DiscountMate > T1 2026 > Recommended Background Reading Web Dev + Machine Learning`
:::

## Background and context

Since project inception many predictive machine learning models have been tried and tested, however many of them remain in the notebook exploratory phase. Another challange has been a lack of centralised and unified data source. For the first time T1 2026 saw in a change in this with a fully pre-processed master table and running price history table. With this the project now has the resources needed to carry out predictive analytics. This write-up will offer a guide on options related to real deployment as well as general instructions on how to access the GCP tables. The following areas will be covered:

1. **Option 1 — Live inference.** The model weights live on the backend; predictions are computed on-the-fly each time a user requests a product page.
2. **Option 2 — Batch pre-compute (recommended).** Predictions for every product are computed once per week by an offline pipeline and written back into the product table as a regular column. The front end reads them like any other product attribute (like it does with price, description etc).

Both options are described in detail below, followed by the recommendation and supporting reasoning.

---

## General Information: Web-app HTTP Routing 


DiscountMate's backend is a **REST-style HTTP API**. Each piece of data the front end needs corresponds to a route — a URL pattern plus an HTTP method — that the backend exposes. The two methods that matter here are:

- **`GET /api/products/{barcode}`** — "give me the current product record". Used by the product page to display name, price, image, description, etc. Returns a JSON payload built from the MongoDB document (soon to be a Postgres row).
- **`POST /api/predict/{barcode}`** — "run an action and return its result". Used when the work being requested is not just a lookup — e.g. running a model. Returns a JSON payload built from whatever the action produced.

A simplified Flask sketch for both routes looks like this:

```python
from flask import Flask, jsonify, request

app = Flask(__name__)

# Read-only lookup — used by both options
@app.get("/api/products/<barcode>")
def get_product(barcode):
    product = product_collection.find_one({"barcode": barcode})
    if product is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(product)

# Action endpoint — only used by Option 1
@app.post("/api/predict/<barcode>")
def predict_price(barcode):
    features = build_features_for(barcode)         # SQL + feature engineering
    prediction = model.predict(features)[0]        # in-process model call
    return jsonify({"barcode": barcode, "predicted_price": float(prediction)})
```

The following points outline the differences between the two options:

- **Where the model object lives.** Loading model weights (`xgb.Booster.load_model(...)` or `pickle.load(open("prophet_meat_mince.pkl","rb"))`) is **expensive**. In any production setup the model is loaded **once** when the Flask process starts and cached as a module-level global — never re-loaded per request. Per-request loads would add hundreds of milliseconds to seconds of latency and exhaust memory.
- **Where the features come from.** Both options need engineered features (lag prices, rolling means, days since last sale, etc.). The difference is *when* they are computed — live (Option 1) or once-per-week ahead of time (Option 2).
- **The JSON contract.** Anything the front end consumes has to be JSON-serialisable. NumPy floats / `pd.Timestamp` objects need to be cast (`float(...)`, `ts.isoformat()`) before being returned, otherwise Flask's `jsonify` will fail. 


---

## Option 1 — Live inference

### How it would work

1. **Train once, store weights.** Train the model (XGBoost or Prophet) on all available historical data and serialise the trained object to the repo or to a cloud bucket. Suggested layout in this repo:

   ```
   ML/
     XGBoostWeights/
       price_predictor_v1.json     # XGBoost native format (preferred over pickle)
       feature_columns.json        # ordered list of input columns the model expects
       metadata.json               # training date, training-set size, metrics
     ProphetWeights/
       meat_mince_500g.pkl
       full_cream_milk_2l.pkl
       ...
   ```

   A note on terminology: the colloquial phrase is "pickle the model", but the technically-correct call is `joblib.dump(model, path)` or — for XGBoost specifically — `model.save_model(path)` (which writes a portable JSON/UBJ file rather than a Python-version-pinned pickle). Prophet objects, because they wrap a Stan model, are most reliably persisted with `joblib`.

2. **Backend boots and loads weights into memory.** When the Flask (or FastAPI) backend starts, it loads each weight file once into a module-level variable:

   ```python
   import xgboost as xgb

   model = xgb.Booster()
   model.load_model("ML/XGBoostWeights/price_predictor_v1.json")

   with open("ML/XGBoostWeights/feature_columns.json") as f:
       FEATURE_COLUMNS = json.load(f)
   ```

3. **User clicks a product on the front end.** The front end fires its usual `GET /api/products/{barcode}` to populate the product page (name, description, image, current price) — same as it does now.

4. **Front end then fires a second request for the prediction.** Typically:

   ```
   POST /api/predict/{barcode}
   ```

   The backend handler for that route does the following on every call:
   - Queries MongoDB (soon Postgres) for the current product row → gets current price, category, attributes.
   - Queries the **price-history table** for that same barcode → gets the time series needed for the lag/rolling features.
   - Runs feature engineering live (compute `price_lag_1w`, `rolling_mean_8w`, `days_since_last_promo`, etc.).
   - Builds a 1-row DataFrame in the exact column order of `FEATURE_COLUMNS`.
   - Calls `model.predict(dmatrix)` (XGBoost) or `model.predict(future_df)` (Prophet).
   - JSON-serialises the result and returns it.

5. **Front end renders the returned prediction.** Typically as a small badge / forecast widget on the product page.

### Required retraining cadence

Whatever data the model was trained on will, by definition, **not include** rows scraped after the training date. Without re-training, accuracy decays as feature distributions drift (new promotional cycles, new products, seasonality changes). There are two retraining strategies:

- **Full retrain on all history** every week. Simple, reproducible, slightly more expensive but for tree-based models like XGBoost the cost is small in absolute terms (minutes). **Recommended** because it sidesteps subtle bugs around partial-fit state and is the easier strategy to audit.
- **Incremental / warm-start.** Continue training the existing booster on only the new week's data. Faster but XGBoost's `xgb_model=` warm-start path has well-known pitfalls (it does not perfectly reproduce a full retrain) and Prophet does not support incremental fitting at all. Only worth considering once full-retrain compute becomes a real bottleneck.

The natural trigger is the existing scrape pipeline: when the weekly catalogue + price scrape completes, fire a retraining job, then atomically replace the weights file in `ML/XGBoostWeights/`. Flask processes will need to be restarted (or hot-reload the weights via a `/admin/reload-model` route protected by an internal token) so the new weights are picked up.

### Cost / complexity profile

- **Per-request cost.** Two database queries + feature engineering + model inference + JSON serialise. For XGBoost this is sub-100 ms on a small product; for per-product Prophet models it can be 200 ms – 1 s because Prophet inference is not particularly fast.
- **Infrastructure.** The Flask app now has to carry model weights in RAM. For one global XGBoost model this is trivial (under 50 MB). For per-product Prophet models it is *not* trivial — 10,000 products × tens of MB each would exhaust the GCP instance memory; you would have to lazy-load Prophet models on demand and evict them, which adds complexity.
- **Engineering effort.** Highest of the two options. Requires: weight-storage convention, model-loading singleton, prediction route, live feature engineering against the history table, JSON contract, retraining job, weight-swap mechanism, and a fallback for when the model is unavailable.

---

## Option 2 — Batch pre-compute (recommended)

### How it would work

1. **Weekly batch job.** A scheduled job (Cloud Run Job / GCP Scheduler / GitHub Action — same trigger as the scraper completion) runs end-to-end:
   - Pulls all historical price data from the history table.
   - Engineers features for **every active product**, not just the one the user happened to click.
   - Trains (or refreshes) the model on all available history.
   - Runs `model.predict(...)` over the full feature matrix → one prediction per product for the next forecast horizon.
2. **Write predictions back to the main product table.** The engineering team adds a column (e.g. `product_predictions` — or a small JSON blob `{predicted_price_next_week, predicted_on_sale_prob, prediction_generated_at, model_version}`) to the product collection / table. The batch job **overwrites** this column for every product each week.
3. **Front end reads it like any other attribute.** The existing `GET /api/products/{barcode}` route now returns the prediction field alongside name, price, description, etc. No new route is needed. The product page renders it directly.

From the front end's perspective the prediction is just another column.

### The HTTP routing picture

Compared with Option 1, the routing is dramatically simpler — there is **no new route**. Everything happens via the existing read endpoint:

```python
@app.get("/api/products/<barcode>")
def get_product(barcode):
    product = product_collection.find_one({"barcode": barcode})
    if product is None:
        return jsonify({"error": "not found"}), 404
    # product["product_predictions"] is already populated by the weekly batch job
    return jsonify(product)
```

The same JSON payload that already drives the product page now carries the prediction field. The front end consumes it with no architectural change.


### Computing Cost 

- **Per-request cost.** Zero additional work versus today. The product page is one MongoDB / Postgres read.
- **Infrastructure on the web tier.** No model weights, no XGBoost dependency, no Prophet dependency on the Flask process. The web tier stays small, fast, and easy to operate.
- **Batch job cost.** Runs once per week, on whatever GCP compute is convenient (Cloud Run Job is the cleanest fit). Total compute is roughly *one* training pass + *N* predictions per week, which for tree-based models is minutes.
- **Failure modes.** If the batch job fails, the product page still renders — it just shows a stale prediction (or null, if the field hasn't been populated yet). There is no user-facing 500 because no prediction code runs on the request path.

---

## Recommendation — Option 2

**Adopt Option 2 (batch pre-compute) as the default deployment pattern for predictive models on DiscountMate.** The reasoning, in order of importance:

1. **It moves all the expensive and brittle work off the request path.** Model loading, feature engineering against the history table, and `model.predict` calls all happen once per week in a controlled environment, not on every user click. The product page therefore stays as fast and as reliable as a plain database read.
2. **It avoids putting heavyweight ML dependencies on the web tier.** XGBoost, Prophet, NumPy, SciPy, cmdstanpy are large, version-sensitive, and a frequent source of deployment headaches. With Option 2 the Flask process never has to import any of them.
3. **It gives the front end uniform access to predictions.** Predictions are available on **listing pages, search results, and category pages** — not just on individual product pages — because they live on every product document. With Option 1 the listing pages would have to fire one `POST /api/predict/...` per product they display, which is operationally infeasible.
4. **Failure isolation.** A bug in the model or feature engineering breaks the next batch run, not the live site. There is no scenario where a model crash 500s the product page.
5. **Compute cost on GCP.** One batch pass per week is much cheaper (and easier to budget) than ad-hoc inference on every product click. There is no autoscaling surprise.
6. **It aligns with the cadence of the upstream data.** Prices and catalogues are refreshed on roughly weekly intervals via the existing scrapers. There is no real value in computing a prediction at sub-weekly granularity because the inputs do not change at sub-weekly granularity. Live inference would simply recompute the same answer on every request.

Option 1 is still the right pattern for use cases where the input genuinely changes per request (e.g. interactive what-if tools, user-specific personalisation, basket-level recommendations). For static-input forecasts like "what will this product's price be next week", Option 2 is the cleaner architecture.

---

## Recommended implementation plan for Option 2

A concrete sequence the next team can execute against:

1. **Stabilise the model code.** Lift the XGBoost training and Prophet training code out of the notebooks into a single Python module under `ML/` (e.g. `ML/training/train_price_model.py`). The module should expose two functions: `train(history_df) → model` and `predict(model, products_df) → predictions_df`. No notebook-only state.
2. **Choose a unified output schema.** A suggested minimum per product:

   ```json
   {
     "predicted_price_next_week": 4.29,
     "predicted_on_sale_prob": 0.18,
     "prediction_generated_at": "2026-05-19T03:00:00Z",
     "model_version": "xgboost_v3"
   }
   ```

   Keeping `prediction_generated_at` and `model_version` is essential for debugging stale or incorrect predictions in production.
3. **Write the batch runner.** A single entry-point script (`ML/jobs/run_weekly_predictions.py`) that:
   - Reads price history from the database.
   - Calls `train(...)`.
   - Calls `predict(...)` over every active product.
   - Bulk-updates the `product_predictions` field via a single batched write (MongoDB `bulk_write` / Postgres `UPDATE ... FROM (VALUES ...)`).
4. **Schedule it.** use Cloud Run Job to trigger this job to run **after** the weekly scrape completes so it always sees the latest data.
5. **Keep a small audit table.** Append every weekly run's summary (`model_version`, `rows_predicted`, `mean_predicted_price`, training metrics) to a `prediction_runs` table. Invaluable when investigating "why did predictions change this week?" later on.

---

## GCP Postgres (provided by the data engineering team)

In the final weeks of this semester one of the junior data engineering students provided a working GCP Postgres instance and a DuckDB-based access layer for it. This is the **canonical data layer that both options should read from and (for Option 2) write back to**. Documenting it here so the next ML team does not have to re-discover it.

### Required environment variables

The connection details (host, port, database, user, password) are sensitive and are **not committed to the repo**. They must be requested from the **academic project mentor**, who will issue a fresh credential set for each new team member.

Once obtained, add them into a local `.env` file next to your notebook / script. An example `.env` looks like this (placeholders only — do not commit your real values):

```env
PGHOST=<example-host-ip>
PGPORT=5432
PGDATABASE=discount_mate
PGUSER=discount_mate_ml
PGPASSWORD=<example-password>
```

:::caution[Credentials policy]
- Never commit `.env` files to the repo. Confirm `.env` is in `.gitignore` before your first commit on a new clone.
- Never paste real credentials into notebooks, Slack, or pull-request descriptions.
- If a credential is accidentally exposed, notify the academic mentor immediately so the DB user can be rotated.
:::

### Connecting via DuckDB

The data engineering student's recommended access pattern uses **DuckDB** with its Postgres extension as a lightweight client. The advantage is that you get DuckDB's fast in-memory analytics on top of live Postgres tables without having to install `psycopg2` / `sqlalchemy` and without round-tripping huge result sets through Python.

```python
# %pip install duckdb python-dotenv pandas

import duckdb
import pandas as pd
from dotenv import load_dotenv

# Load PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD from .env
load_dotenv()

conn = duckdb.connect(database=":memory:")
conn.execute("INSTALL postgres")
conn.execute("LOAD postgres")

# DuckDB's postgres extension reads the standard PG* env vars automatically
conn.execute("ATTACH '' AS pg_db (TYPE postgres)")

print("Connected to PostgreSQL through DuckDB.")
```

A quick sanity-check query that lists the user-visible tables:

```python
query = """
SELECT table_schema, table_name, table_type
FROM pg_db.information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name
LIMIT 10;
"""
conn.execute(query).df()
```

### Schema overview — what each table is for

At the time of writing the visible tables under the `silver` schema were:

| Schema  | Table | Purpose |
| ------- | ----- | ------- |
| `silver` | `dim_products` | **Master product dimension table.** One row per product. This is the table predictions get written back to under Option 2 — and it is what the backend `GET /api/products/{barcode}` route reads from. |
| `silver` | `fct_product_prices` | **Historic price fact table.** One row per (product × observation date). This is the **training data source** for any price / promotion model. All lag-feature engineering reads from here. |
| `silver` | `dim_retailers` |  |
| `silver` | `dim_categories` |  |
| `silver` | `demo_product_pricing_summary` | |
| `silver` | `static_master_coles_products` | Coles-only static product snapshot|
| `public` | `alembic_version` |  |

The two tables that matter for predictive modelling are therefore:

- **`silver.fct_product_prices`** → read-only input for **training** and **feature engineering**.
- **`silver.dim_products`** → target for the weekly **prediction write-back** (Option 2). Also the table the **product page API** already reads.

### Read pattern — pulling training data

```python
history_df = conn.execute("""
    SELECT *
    FROM pg_db.silver.fct_product_prices
    WHERE observation_date >= DATE 'insert date or use all no exclusion'
""").df()

products_df = conn.execute("""
    SELECT *
    FROM pg_db.silver.dim_products
""").df()
```

These two DataFrames are the inputs the Option 2 batch runner should be built around.

### Write pattern — pushing predictions back to `dim_products`

The DE notebook demonstrates the write pattern using the `demo_product_pricing_summary` table:

```python
inserted = conn.execute("""
    INSERT INTO pg_db.silver.demo_product_pricing_summary (
        retailer, run_date, category,
        product_count, priced_product_count,
        avg_current_price, min_current_price, max_current_price,
        discounted_product_count, loaded_at
    )
    SELECT
        retailer, run_date, category,
        product_count, priced_product_count,
        avg_current_price, min_current_price, max_current_price,
        discounted_product_count, loaded_at
    FROM mock_df
""").df()
```

The same `INSERT ... SELECT FROM <python_df>` pattern  is exactly what the Option 2 weekly job needs except the target table is `silver.dim_products` and the operation is an `UPDATE` (or `MERGE`) on a `product_predictions` column rather than an `INSERT`. **Seek additional confirmation before running**

A sketch of the prediction write-back:

```python
# predictions_df has columns: barcode, predicted_price_next_week,
# predicted_on_sale_prob, prediction_generated_at, model_version

conn.execute("""
    UPDATE pg_db.silver.dim_products AS p
    SET product_predictions = json_object(
            'predicted_price_next_week', s.predicted_price_next_week,
            'predicted_on_sale_prob',    s.predicted_on_sale_prob,
            'prediction_generated_at',   s.prediction_generated_at,
            'model_version',             s.model_version
        )
    FROM predictions_df AS s
    WHERE p.barcode = s.barcode
""")
```

Two things to coordinate with the DE team before the first write-back:

1. **Add the `product_predictions` column to `dim_products`**.
2. **Decide on the unique key for the join.** `barcode` is the natural candidate.

### How this slots into Options 1 and 2

- **Option 1 (live inference).** The Flask handler for `POST /api/predict/{barcode}` opens a DuckDB connection (or, better, a pooled `psycopg2` connection on the web tier), reads the relevant history rows out of `silver.fct_product_prices` for the requested barcode, builds features, predicts, and returns JSON. DuckDB-via-extension is fine for ad-hoc notebook work but for the request path a proper Postgres driver with a connection pool is more appropriate.
- **Option 2 (batch pre-compute).** The weekly job reads **all** of `silver.fct_product_prices` and `silver.dim_products` once, trains, predicts for every product, and bulk-updates the `product_predictions` column on `dim_products`. The backend's existing read route picks the predictions up for free.

---
