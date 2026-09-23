# GA4 behavioural segmentation — team handoff

Shared entry point for DA-01 cleaning outputs, reproduction and downstream dependencies. Maintain implementation updates here; individual contribution records belong in OnTrack.

## Outputs and validation

| Dataset | Input → output (in `../Data/`) | Users retained | Missing first-visit values filled |
| --- | --- | ---: | ---: |
| BigQuery | `Original_bigquery_data.csv` → `cleaned_bigquery_users.csv` | 21 | 5 |
| Synthetic | `synthetic_users_20260831.csv` → `cleaned_synthetic_users_20260831.csv` | 1,500 | 300 |

Raw inputs, user IDs and observed behavioural values are preserved. Both cleaned outputs have no missing cells. Keep synthetic and real-data results distinct.

- [`clean_discountmate_data.py`](../clean_discountmate_data.py) validates schemas, types, uniqueness and behavioural constraints, then reloads the saved output. It rejects duplicate output rows, incorrect row counts, reordered/extra columns and retained excluded users.
- Missing `days_since_first_visit` values use the rounded observed median, raised where necessary to preserve `days_since_last_activity <= days_since_first_visit`. BigQuery's median 8.5 rounds to 8 using Python's ties-to-even rule; two replacements rise to 9 and 10. The synthetic median is 9, with two replacements raised to 10. Team acceptance of this method remains pending.
- BigQuery's constant `avg_percent_scrolled` value (90) is omitted from the cleaned output. Nonconstant scroll data stops validation for review. No scaling or p99 capping is applied.
- All nine tests in [`test_clean_discountmate_data.py`](../test_clean_discountmate_data.py) passed. Independent checks confirmed row counts, unchanged IDs and observed values, imputations, recency and checksums.
- Run evidence is retained in [`bigquery_cleaning_report.json`](bigquery_cleaning_report.json) and [`cleaning_report.json`](cleaning_report.json).

## Reproduce

Run from `Data Analysis/GA4 Behavioural Segmentation - T2 2026`:

```bash
# Published BigQuery source
python3 clean_discountmate_data.py

# Separate synthetic source
python3 clean_discountmate_data.py --input Data/synthetic_users_20260831.csv --output Data/cleaned_synthetic_users_20260831.csv --report Documentation/cleaning_report.json

python3 -m unittest -v
```

[`generate_discountmate_synthetic_users.py`](../generate_discountmate_synthetic_users.py) reproduces the synthetic source with seed `20260831`, a 17–30 August 2026 window and 300 missing first-visit values. The configured mix is 35% budget, 25% family, 15% health, 5% convenience, 5% premium and 15% residual. Sampling uses configured ranges, 10% Gaussian noise, clipping, affinity sums capped at 0.95 and shuffled rows. These are implementation settings; original archetype compliance is unverified. All synthetic inclusion flags are 1, including 32 users with mean engagement below 10 seconds; aggregate means do not establish session-level eligibility.

## Integration and open decisions

1. **Source:** reconcile the published 21-user export with T11's 28-user sample. BigQuery lacks reporting dates and inclusion flags; no eligibility filtering was applied and source evidence is needed.
2. **Specifications:** obtain original T3/T7 requirements, archetype definitions and readable modelling documentation. See the [verification record](SPECIFICATION_VERIFICATION.md).
3. **Modelling:** cleaned features are unscaled. The notebook expects 12 `mm_` features in `discountmate_clustering_ready_minmax_20260831.csv`; confirm preprocessing and input lineage before use. Preserve IDs separately for joins and exclude them from model features. Saved synthetic results do not validate real users.
4. **Power BI:** agree on ownership and export columns for cluster assignments/persona labels, which are absent from these CSVs. Import `user_pseudo_id` as Text, count/day fields as Whole Number and other features as Decimal Number.

Changes follow Team Lead review and mentor approval/merge. This handoff records the cleaning implementation and dependencies, without claiming completion of the full modelling or persona-visualisation feature.
