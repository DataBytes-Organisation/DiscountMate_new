# Specification verification — 14 September 2026

## Verdict

The corrected cleaning pipeline and both saved outputs pass the implemented contract and the checks supported by the local handoff notes. Full compliance with the original DA-01 specifications is **not verified** because the original T3, T7 and Persona Archetype Definitions were not available. A validation PASS does not mean those source requirements or team decisions have been approved.

## Evidence and source limitations

- Inspected the user-supplied [Documentation folder](https://github.com/DataBytes-Organisation/DiscountMate_new/tree/main/Documentation), including `README.md` and relevant sections of [SRS.md](https://github.com/DataBytes-Organisation/DiscountMate_new/blob/main/Documentation/SRS.md). The SRS identifies itself as version 0.1 dated 20 April 2024, with revision entries in April/May 2024. It describes broad behavioural analysis and customer segmentation, but has no DA-01-T3/T7 identifiers, GA4 feature dictionary, quantitative archetype ranges, imputation rules or scaler selection. Its narrative personas are Sarah (budget-conscious), David (tech-savvy), and Emily (health-conscious); they cannot establish the five-persona-plus-residual proportions in the 2026 synthetic generator.
- The Documentation README describes a team-branch/trimester-branch workflow. This differs from the more recent team messages supplied by the user. It was treated as reference material, not authorization to create branches, publish, or merge anything.
- Reviewed `DATA_CLEANING_HANDOFF.md`, `SYNTHETIC_METHOD_NOTE.md`, `BIGQUERY_HANDOFF.md`, code, tests, raw files and saved outputs. The local notes are secondary summaries, not independent original specifications.
- Searched the complete current GitHub repository tree (not truncated), repository code for DA-01-T7, relevant PR search, and local project/document locations. No original T3/T7 or archetype document was located.
- Current BigQuery source: [Original_bigquery_data.csv](https://github.com/DataBytes-Organisation/DiscountMate_new/blob/main/Data%20Analysis/GA4%20Behavioural%20Segmentation%20-%20T2%202026/Data/Original_bigquery_data.csv), Git blob `ca03717ad4f735017cb5db1774895dbc865d1cf0`.
- [Modelling_Documentation.docx](https://github.com/DataBytes-Organisation/DiscountMate_new/blob/main/Data%20Analysis/GA4%20Behavioural%20Segmentation%20-%20T2%202026/Documentation/Modelling_Documentation.docx) is corrupted. The downloaded bytes match repository blob `bfacfe752ceb162f2623076f678c7842535527cb`; ZIP parsing fails with `Bad magic number for central directory`. Its path history contains only the introducing commit `e9824a356f1121170b5a8f2d850f8e18d94f79e7`. There is no earlier version on that path to verify instead.
- The repository modelling notebook expects 12 Min-Max-scaled `mm_` features from `discountmate_clustering_ready_minmax_20260831.csv`. Cleaning produces unscaled features. Notebook expectations establish an integration dependency, not the original task allocation or acceptance criteria.

## Requirement comparison

| Requirement or claim | Evidence checked | Result |
| --- | --- | --- |
| SRS: use interaction/usage data to analyse behaviour | SRS section 2.1.2.2 and Data collection; cleaned engagement, page and affinity features | Supports the broad purpose; does not prove product-level acceptance |
| SRS: customer segments and profiling reports for marketing managers | SRS User stories; current output has behavioural features but no segments or report | Downstream feature incomplete; not evidence that this entire feature belongs to Tanvi |
| SRS narrative personas | Sarah, David and Emily compared with local synthetic generation notes | Different abstraction/version; no supported numerical mapping, so no invented relabelling |
| Keep original data unchanged | Source/output separation, SHA-256 audit checks; BigQuery Git blob | Pass |
| Preserve user IDs and observed behavioural values | Independent raw/output comparison for both datasets | Pass |
| Retain 21 BigQuery users and 1,500 synthetic users | Physical saved CSV row counts and distinct IDs | Pass |
| Fill only missing first-visit values | Five BigQuery and 300 synthetic imputations, no other observed values changed | Pass against local method |
| Use rounded median and preserve recency order | BigQuery median 8.5 rounds to 8; five replacements are 8, 8, 10, 8, 9. Synthetic median is 9 with two adjustments to 10 | Pass against local method; team acceptance unresolved |
| No duplicate rows, missing output cells or conflicting IDs | Reload checks, independent audit and regression suite | Pass |
| Preserve canonical output schema | Synthetic 16 columns; BigQuery ID plus 12 features; strict output order check | Pass against implemented schemas; T7 comparison unavailable |
| Exclude non-informative scroll feature | All 21 raw scroll values are 90; absent from cleaned BigQuery file | Pass against local rationale; original specification unavailable |
| Apply eligibility rules | Synthetic flags are all 1. BigQuery lacks flag and session-level engagement evidence | BigQuery eligibility unverified; no fabricated flag |
| Record reporting window | Synthetic dates retained; BigQuery export has no dates | BigQuery source information missing |
| Apply p99/scaling as assigned | Both reports correctly state these are not applied | Cleaning behaviour verified; stage ownership and approved scaler require original T3/T7 |
| Synthetic persona proportions and value ranges conform to original definitions | Generator encodes local settings, but original archetype document is absent and exported rows have no archetype labels | Original-definition compliance unverified |
| Feed current modelling notebook | Cleaner does not emit the required scaled file or `mm_` columns | Downstream transformation remains outstanding |
| Power BI persona handoff | Cleaned CSV contains no cluster assignments or persona labels | Not a complete persona dashboard dataset; modelling/DA-02 handoff remains outstanding |

## Fixes completed

1. Output verification now rejects any exact duplicate rows rather than silently deduplicating them. Row counts use physical parsed CSV records.
2. Output verification also rejects reordered/extra columns and retained users marked excluded.
3. Historical synthetic instructions now give explicit input, output and report arguments from the GA4 folder.
4. Root test discovery loads the canonical GA4 suite, preventing two copied test files from drifting apart.
5. Both JSON reports now explicitly distinguish implemented validation from unverified original-specification compliance. The synthetic report paths were refreshed after folder relocation.

## Executed verification

- Nine regression tests pass from both the GA4 folder and workspace entry point. Tests include the reproduced duplicate-output defect, incorrect physical row count, retained exclusion flags and reordered output columns.
- Both documented cleaning commands ran successfully and refreshed the reports.
- Independent CSV comparisons verified row counts, unique and unchanged IDs, unchanged observed values, missing-cell counts, recency ordering and input/output checksums for both outputs.
- No modelling rerun, Power BI import, PR submission or GitHub merge was performed.

## Inputs needed to finish original-specification verification

Supply the original DA-01-T3 requirements, DA-01-T7 data dictionary and Persona Archetype Definitions, plus a readable replacement of the modelling document. Compare their actual wording before changing imputation, eligibility, reporting-window, capping or scaling rules. Robin/source owners still need to identify the BigQuery window and eligibility evidence, and the agreed owner of the transformed/model-labelled handoff.

## Additional evidence: user-supplied DA-01-T11

The user subsequently supplied the text of **DA-01-T11: Interpret Behavioural Clusters vs T1 Personas**. This is a downstream interpretation report dependent on T10, not the T3/T7 cleaning specifications. It names five T1 personas and provides conceptual cluster mappings, but does not supply quantitative archetype-generation ranges or a cleaning contract.

Compared its claims with saved outputs in the [repository modelling notebook](https://github.com/DataBytes-Organisation/DiscountMate_new/blob/main/Data%20Analysis/GA4%20Behavioural%20Segmentation%20-%20T2%202026/DiscountMate_Clustering_Model.ipynb), blob `87aaef294b2117fd9fe43466c354ac411b786a4b`:

| T11 claim | Notebook evidence | Assessment |
| --- | --- | --- |
| K=4; silhouette approximately 0.484 | Saved score 0.483568; highest among tested K=2..8 | Consistent |
| Cluster counts 300, 525, 300, 375 | Saved label counts match, total 1,500 | Consistent |
| PCA explains approximately 67.9% | 0.44707076 + 0.23186538 = 0.67893614 | Consistent |
| DBSCAN finds one cluster and mostly noise | 293 clustered users, 1,207 noise users (80.47%) | Consistent for eps=0.30, min_samples=10 |
| Cluster 0 explores products | Highest scaled means for product-detail ratio (0.764), category browsing (0.683), engagement time (0.703) | Interpretation supported within synthetic run |
| Cluster 1 focuses on deals/comparison | Highest comparison (0.729) and specials (0.724) scaled means | Interpretation supported within synthetic run |
| Cluster 2 has low engagement | Lowest sessions, engagement time and pageviews means; recency features should not be interpreted as activity intensity | Interpretation supported within synthetic run |
| Cluster 3 shows planning/activity | Highest My Lists (0.737), sessions (0.712), unique pages (0.722), pageviews/session (0.679) scaled means | Interpretation supported within synthetic run |
| Original real GA4 sample had 28 users | Current published BigQuery file has 21 users | Unresolved dataset-version discrepancy; do not silently replace either count |

These are checks against saved notebook evidence, not a reproduced model run. The exact scaled model-input file and its preprocessing lineage have not been verified against the locally cleaned synthetic file. Matching total population sizes does not establish dataset identity.

T11 explicitly confirms synthetic modelling. Its references to “observed interactions” and conclusions about DiscountMate users should therefore be qualified as synthetic behaviour patterns until real-data validation. In particular, section 4's population-level statement should read: “The synthetic dataset exhibits distinct interaction patterns; whether these patterns represent real DiscountMate users requires validation.”

The conceptual mapping in T11 is deliberately not one-to-one. Health, convenience, family status and premium intent cannot be inferred from the current broad interaction features. Cluster labels remain pending Feature 1 team confirmation. No labels have been added to the 21 real users, and no model assignments have been fabricated.

Next evidence needed for the 28-versus-21 discrepancy: the exact original 28-user filename, reporting window, export/version and any seven-user filtering explanation. T11 does not require replacing the completed synthetic model with a 21-user real-data run; the real-data cleaning output is a separate deliverable.
