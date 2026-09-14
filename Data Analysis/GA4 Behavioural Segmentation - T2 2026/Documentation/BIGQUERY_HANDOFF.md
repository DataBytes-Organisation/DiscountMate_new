# Tanvi — BigQuery cleaning handoff

## Current source and results

Source: [Original_bigquery_data.csv](https://github.com/DataBytes-Organisation/DiscountMate_new/blob/main/Data%20Analysis/GA4%20Behavioural%20Segmentation%20-%20T2%202026/Data/Original_bigquery_data.csv).
Git blob SHA: `ca03717ad4f735017cb5db1774895dbc865d1cf0`. Retrieved from `main` on 2026-09-14.
This is the file currently published in the GA4 Data folder. Its presence does not establish team approval or its reporting window.

The source contains 21 users and 14 columns. Cleaning retains all 21 users and exports `Data/cleaned_bigquery_users.csv` with user ID and 12 unscaled behavioural features.

- Five missing `days_since_first_visit` values were imputed using the observed median 8.5, rounded to 8 with Python's ties-to-even rounding. Two imputations were raised to 9 and 10 respectively to preserve recency ordering.
- `avg_percent_scrolled` is 90 for every source row and is excluded from the modelling output. The raw file preserves it. Future nonconstant scroll data causes validation to stop for review.
- No duplicate users or rows were found. User IDs remain strings, preserving all digits.
- Reporting dates and `is_included_in_run` are unavailable and were not fabricated. No eligibility filtering was applied. Two users have mean engagement below 10 seconds; this does not establish their session-level eligibility.
- No scaling or p99 capping was applied. The synthetic-only sum-of-affinities cap is not assumed for real BigQuery data.

Checksums, imputation counts, and post-write validation are recorded in `bigquery_cleaning_report.json`. The imputation method is an existing implementation decision, not a newly confirmed team requirement.

## Reproduce

From the GA4 folder:

```bash
python3 clean_discountmate_data.py
python3 -m unittest -v
```

The default input is `Data/Original_bigquery_data.csv`. Override `--input`, `--output`, and `--report` together for another run. Input and output must be distinct. The synthetic generator and data remain available for explicitly synthetic validation.

## Modelling and Power BI handoff

The current repository notebook reads `discountmate_clustering_ready_minmax_20260831.csv` and expects 12 `mm_` feature columns. This cleaned file is unscaled and cannot directly replace that input. The modelling owner must prepare the agreed transformations and rerun/evaluate the models against the confirmed source. Existing synthetic evaluation results should not be relabelled as real-data results.

For Power BI, import the cleaned CSV as UTF-8 comma-delimited data and explicitly set `user_pseudo_id` to Text before automatic numeric conversion. Count and day fields are Whole Number; remaining features are Decimal Number. The file contains no cluster assignments or persona names. The modelling owner must supply those keyed by user ID, and DA-02 must confirm the final export columns and joins. Reporting dates and eligibility also require source-owner clarification.

## Review status

The duplicate-output verification issue and historical reproduction instructions have been corrected. Nine regression tests pass, and independent checks confirm both saved datasets preserve IDs and observed values. See `SPECIFICATION_VERIFICATION.md` for the requirement-by-requirement review, including the general 2024 SRS supplied by the user. Original T2 2026 DA-01 specifications remain unavailable; technical validation is not full specification approval.

Submit the GA4 changes through a feature branch in Tanvi's fork. Team Lead review and mentor approval are required before merging into the main repository.
