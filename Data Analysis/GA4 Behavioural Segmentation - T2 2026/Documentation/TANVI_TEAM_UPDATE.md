> Historical synthetic-data record. These results do not describe the BigQuery run. See BIGQUERY_HANDOFF.md for the current real-data handoff.

# Tanvi — Data Cleaning Update

Hi team,

I have completed the cleaning, validation, documentation, and technical handoff for
the DiscountMate synthetic behavioural dataset.

I preserved the original source file and created a reproducible cleaning script. I
validated the schema, data types, reporting dates, user-ID uniqueness, duplicates,
missing values, ratio and entropy limits, recency ordering, inclusion flags, and
pageview consistency. I also added a post-write check that reopens the cleaned file
and validates it again.

The source contained 1,500 unique users and no duplicate or excluded records. The
only missing data was the documented 300 values in `days_since_first_visit`. I used
the observed median of 9 days for imputation and adjusted two records to 10 days so
that `days_since_first_visit` remained greater than or equal to
`days_since_last_activity`. The final dataset retains all 1,500 users, has no missing
values, and passes every implemented validation check.

I have documented the decisions that differ from or clarify T3/T7. In particular,
`avg_percent_scrolled` remains excluded because it is unavailable in the source and
was documented as having insufficient variance. The 32 low-engagement residual records
were retained because all source rows are marked for inclusion. I did not apply p99
capping or scaling during cleaning; those remain downstream transformation decisions.
The final modelling report should note that Min-Max scaling was reportedly used for
both models even though T3/T7 specify Z-score standardisation for K-means and Min-Max
normalisation for DBSCAN.

The cleaned CSV, cleaning script, JSON audit report, and detailed handoff document
are ready. For the final modelling run, I need the DA/ML team to confirm the median
imputation decision, and Carlin to confirm that the cleaned CSV is being used before
transformation and record the final scaler used for each model.

Thanks,  
Tanvi
