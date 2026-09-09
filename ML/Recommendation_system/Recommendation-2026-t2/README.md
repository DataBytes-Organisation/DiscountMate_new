# Recommendation System — REES46 Purchase Probability Ranking

This sub-project prepares the REES46 behavioural data and trains a model that estimates the probability that a user will purchase a product within the next three days. Products are ranked by this probability to produce homepage Top-10 recommendations.

## Project workflow and ownership

| Stage | Main file | Contributor |
|---|---|---|
| Time-based train/validation/test split | `data/train.parquet`, `data/validation.parquet`, `data/test.parquet` | **SERAY MIRNAK GULSEVEN** |
| User-product interaction aggregation | `feature2_dataagg.ipynb` | **ISHANI SACHIN BHONGALE** |
| Initial additional-feature prototype | `extract.ipynb` | **ROHIT SRINIVAS SHIBINENI** |
| Leakage-safe features, model comparison and Top-10 evaluation | `DiscountMate_additional_features_model.ipynb` | Team Leader **Ethan Fu** |

## 1. DL-05-T7: Time-based train/validation/test split

**Contributor: SERAY MIRNAK GULSEVEN**

The source is the Kaggle **REES46 eCommerce Behavior Data from Multi-Category Store** dataset (`mkechinov/ecommerce-behavior-data-from-multi-category-store`). The October file, `2019-Oct.csv`, contains 42,448,764 events from 1–31 October 2019. The retained columns are:

`event_time`, `event_type`, `product_id`, `category_id`, `category_code`, `brand`, `price`, `user_id`, and `user_session`.

### Split method

The 5.67 GB CSV was processed in chunks of 2,000,000 rows using reduced dtypes. Each event was assigned immediately using fixed chronological cutoffs:

- **Train:** before 22 October 2019
- **Validation:** from 22 October up to, but not including, 27 October 2019
- **Test:** from 27 October 2019 onward

The chunk-level results were concatenated and saved as Parquet files. Cold-start users were deliberately retained for realistic fallback evaluation. Timestamp checks confirmed that train precedes validation and validation precedes test, so there is no time overlap between splits.

| Split | Rows | Share |
|---|---:|---:|
| Train | 29,218,702 | 68.8% |
| Validation | 6,897,095 | 16.2% |
| Test | 6,332,967 | 14.9% |
| **Total** | **42,448,764** | **100%** |

- Cold-start users first seen in validation: **391,205**
- Cold-start users first seen in test: **318,885**
- Cold-start users removed: **No**
- Leakage check: **Passed**

## 2. User-product interaction aggregation

**Notebook:** `feature2_dataagg.ipynb`  
**Contributor: ISHANI SACHIN BHONGALE**

This notebook reads the three event-level Parquet splits, removes records with missing essential IDs, and aggregates events by `(user_id, product_id)`. It produces:

- `clicks`: number of `view` events;
- `cart`: number of `cart` events;
- `purchase`: number of `purchase` events.

It also checks event totals, user/product coverage and cold-start users, then exports both Parquet and CSV versions under `data/Time_based_datasets/`.

> Path note: this legacy notebook was written before the files were moved under `data/`. When rerunning it in the current folder, use `data/train.parquet`, `data/validation.parquet`, and `data/test.parquet` as inputs and write its outputs to `data/Time_based_datasets/`.

## 3. Initial additional-feature prototype

**Notebook:** `extract.ipynb`  
**Contributor: ROHIT SRINIVAS SHIBINENI**

This notebook first reports split statistics and event counts. Its prototype feature extractor creates one row per user-product pair from `train.parquet` and calculates:

- `days_since_last_view`, `days_since_last_cart`, and `session_count`;
- `user_total_views` and `user_unique_products`;
- `product_total_carts` and the latest known `price`.

When run, the prototype writes `train_features.parquet`. It established the initial feature design; future-horizon labels, multi-snapshot training, model comparison and test evaluation are added in the next notebook.

> Path note: `extract.ipynb` also uses the earlier root-level path convention; change its input to `data/train.parquet` when rerunning it in the current folder.

## 4. Additional features and purchase-probability model

**Notebook:** `DiscountMate_additional_features_model.ipynb`  
**Contributor: Team Leader Ethan Fu**

This notebook extends the user-product interaction idea from `feature2_dataagg.ipynb`. It reads the three **event-level** Parquet files directly because timestamps, sessions, prices, brands and categories are required and are no longer available in the aggregated `Time_based_datasets` files.

### Leakage-safe snapshots and label

- Feature history: the seven days strictly before each cutoff.
- Candidate pair: a user-product pair with at least one event in the final two history days.
- Label: `1` if that user purchases that product in the following three days; otherwise `0`.
- Training cutoffs: 8, 13 and 19 October 2019.
- Validation cutoff: 24 October 2019.
- Test cutoff: 29 October 2019.

This produces 60 output columns: four identifiers/metadata columns, `label`, and **55 model features**.

### Current features

| Group | Features and derivation |
|---|---|
| User-product behaviour | Event, view, cart and past-purchase counts; sessions; active days; average/latest/variation in price; latest event hour and weekday, aggregated over the seven-day history. |
| User profile | Total events/views/carts/purchases, unique products, sessions, active days and average interacted price. |
| Product popularity | Total events/views/carts/purchases, unique users, sessions and average price. |
| Category and brand popularity | View/cart/purchase totals, unique users and category product count. |
| Recency | Days since the pair's first/last event, last view, last cart and last purchase, plus user and product last-event recency. |
| Rates and relative features | View-to-cart and cart-to-purchase rates; user/product/category/brand rates; pair share of views; relative price; events per active day. |

Generated datasets are stored in `data/Additional_Features/`. Identity fields (`user_id`, `product_id`, `category_id`, `snapshot_date`) are not passed to the model.

### Training and model selection

All 23,390 positive training rows are retained. A reproducible sample of 250,000 negatives is used, with negative weight `20.257` to restore the original class contribution. Model selection uses the later validation snapshot only; the test snapshot is not used to choose the model.

| Candidate | Main configuration |
|---|---|
| Logistic Regression | Median imputation, `log1p`, standardisation, `C=1.0`, `max_iter=300`, `random_state=42` |
| HistGradientBoosting-31 | `learning_rate=0.08`, `max_iter=180`, `max_leaf_nodes=31`, `min_samples_leaf=50`, `l2=1.0` |
| HistGradientBoosting-63 | `learning_rate=0.06`, `max_iter=220`, `max_leaf_nodes=63`, `min_samples_leaf=75`, `l2=2.0` |

Both boosting models use early stopping, `validation_fraction=0.1`, `n_iter_no_change=15`, and `random_state=42`. Models are ranked by validation `NDCG@10`, then PR-AUC. **Logistic Regression** achieved the best validation NDCG@10 and was selected. Its probabilities were sigmoid-calibrated on validation data and exported to:

`models/DiscountMate_REES46_purchase_probability_model.joblib`

The validation-selected classification threshold is `0.130622`, but homepage recommendation should rank continuous probabilities rather than apply this threshold.

### Final test performance

| Metric | Result |
|---|---:|
| PR-AUC | 0.1301 |
| ROC-AUC | 0.8977 |
| Log Loss | 0.01849 |
| Brier Score | 0.00349 |
| Candidate-pair coverage | 11.71% |
| Overall Recall@10 | 11.35% |
| Recall@10 within covered candidates | 96.88% |
| Overall HitRate@10 | 13.11% |
| Overall NDCG@10 | 0.09997 |

The model ranks products well once they enter the recent-interaction candidate set. End-to-end recall is limited mainly by candidate coverage, so a broader candidate generator should be added in future work.

## 5. How to use the exported model

### Required input

For offline or live scoring, first reproduce Section 1 of `DiscountMate_additional_features_model.ipynb` at the scoring cutoff:

1. Use only events from the previous seven days; never use events at or after the cutoff.
2. Create candidates from user-product pairs active in the final two days.
3. Calculate the same 55 features with the same names and definitions.
4. Do not create or pass `label` during live inference.

The exported bundle stores the exact ordered feature list, so always select `bundle["feature_columns"]` before prediction.

```python
import joblib
import polars as pl

bundle = joblib.load(
    "models/DiscountMate_REES46_purchase_probability_model.joblib"
)

# Example: a feature file produced by Section 1 of the notebook.
candidates = pl.read_parquet(
    "data/Additional_Features/DiscountMATE_REES46_test_additional_features.parquet"
)

X = candidates.select(bundle["feature_columns"]).to_pandas()
probability = bundle["estimator"].predict_proba(X)[:, 1]

scored = candidates.select("user_id", "product_id").with_columns(
    pl.Series("purchase_probability", probability)
)

top_10 = (
    scored.sort(
        ["user_id", "purchase_probability", "product_id"],
        descending=[False, True, False],
    )
    .group_by("user_id", maintain_order=True)
    .head(10)
)
```

`purchase_probability` is the recommendation confidence. For each user, rank it from highest to lowest and display the first ten products. The stored classification threshold is only for binary diagnostics and is not required for Top-10 ranking.

## Repository preparation

Team Leader **Ethan Fu** organised this recommendation-system functionality and the files in this folder, and submitted the pull request.
