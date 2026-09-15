# Specification verification

Review date: 14 September 2026. See the [team handoff](README.md) for outputs and reproduction.

**Status:** saved cleaning outputs pass implemented checks. Full original-specification compliance remains unverified; validation PASS is not specification approval.

| Evidence | Finding / remaining action |
| --- | --- |
| Original DA-01-T3, T7 and Persona Archetype Definitions | Not located during review. Obtain originals before accepting schema, imputation, eligibility or synthetic-range compliance. |
| Repository `Documentation/SRS.md` | General 2024 segmentation requirements; no T3/T7 cleaning contract or quantitative archetype definitions. |
| `Data/Original_bigquery_data.csv` | 21 users; Git blob `ca03717ad4f735017cb5db1774895dbc865d1cf0`. Reporting dates and session-level eligibility evidence are absent. |
| Supplied DA-01-T11 | Refers to a 28-user real sample. Confirm exact export, window and filtering explaining the difference from the 21-user source. |
| `DiscountMate_Clustering_Model.ipynb` saved outputs | Synthetic population 1,500; K=4, silhouette 0.483568, counts 300/525/300/375, PCA variance 67.89%, DBSCAN 293 clustered and 1,207 noise. Consistent with T11's summary, but not reproduced in this cleaning review. |
| Model input lineage | Scaled `mm_` input identity with the cleaned synthetic output is unverified; matching row counts are insufficient evidence. |
| `Documentation/Modelling_Documentation.docx` | Repository bytes failed ZIP parsing (blob `bfacfe752ceb162f2623076f678c7842535527cb`); obtain a readable replacement. |
| Cleaning code and CSVs | Nine tests passed; independent comparisons confirmed preserved IDs/observed values, 21/1,500 users, 5/300 imputations, recency and checksums. |

T11's persona mappings remain conceptual and require team confirmation. Synthetic patterns should not be presented as findings about actual users. No real-user cluster assignments or persona labels were created by the cleaning pipeline.
