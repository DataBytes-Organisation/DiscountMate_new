# Makes sure the code can run no matter what different versions of Python you have
from __future__ import annotations

"""
IGA ETL Pipeline Script
Student: Anna Margarita Sofia T. Licup (Margie)

Last Modified: 02/05/2026

Note: [Based on IGA Preprocessing Script](https://colab.research.google.com/drive/1jq429nxZiSCqlNU7-E91U4oOlkchDjmo#scrollTo=a1b2c3d4)
"""

"""
Libraries for Preprocessing
We need to import these to make sure that we're able to use the commands from the different libraries to process and upload the cleaned data.
"""

# Helps read files on the computer
from pathlib import Path

# Helps with code quality > additional layer of checking
from typing import TYPE_CHECKING

# Imports the SQL engine for data transformation
import duckdb

# Gives the pipeline a start date and an end date
from common.cli import iter_dates

# Writes the cleaned data into the final database
from common.db import load_demo_slice

# Imports the library to be able to use the SQL commands (load_sql) 
from common.duckdb_utils import load_sql

# Finds the scraped file based on retailer name and scrape date (no need to
# hardcode anymore)
from common.paths import resolve_input_path

# Works as a checker while the script is being developed???zZ
if TYPE_CHECKING:
    # Shows how many rows and dates have been processed (cleaned and uploaded)
    from common.job_models import JobSummary
    # Gets the settings and runtime when the script is being run
    from config.settings import AppSettings, RuntimeConfig

"""
Setup: Loading the SQL Instruction Files

Finds the folder where the job file is located and gets the two instruction files the pipeline needs:

*   demo_transform.sql: standardized calculation, categories and removes duplicates
*   qa_check.sql: data quality checker file before uploading (valid prices and dates)

"""

# Gets the location of the job.py file, specifically the folder it's in
SQL_ROOT = Path(__file__).resolve().parent

# Retrieves the workflow_sql file
WORKFLOW_SQL_DIR = SQL_ROOT / "workflow_sql"

# Looks for the "products" file where it'll base its data from
RUNNER = "products"

# Gets the file which helps cleans up the data?
TRANSFORM_SQL = load_sql(WORKFLOW_SQL_DIR / "demo_transform.sql")

# Gets the quality check file
QA_CHECK_SQL = load_sql(WORKFLOW_SQL_DIR / "qa_check.sql")

"""
Additional checker: Counting the Rows from the Cleaned Data

Counts how many rows were successfully cleaned and loaded.

If none then it stops the pipeline and reports what caused the problem so it can be checked
"""

# Gets how many rows were transformed basically
def _fetch_scalar(conn: duckdb.DuckDBPyConnection, query: str) -> int:
    row = conn.execute(query).fetchone()
    # If nothing was cleaned and uploaded, it determines where it went wrong
    if row is None:
        raise RuntimeError(f"Expected a scalar result for query: {query}")
    # otherwise, it should return a number
    return int(row[0])

"""
Clean-Up Step 1: Loading the Raw IGA File

Reads the raw IGA CSV file and loads all of its rows and columns into a temporary table before cleaning.

Every column is converted to text first. The first row is considered as column headers than real data, and any existing data in the workspace is replaced to prevent duplicates from previous runs.

It also gets the total number of rows loaded so it can be recorded in the run summary.
"""

# Loads the scraped files into a temp table
def _load_input_file(conn: duckdb.DuckDBPyConnection, input_path: Path) -> int:
   # Reads the IGA CSV file and loads all rows and columns in a temp table (raw_input), replaces the data each time so no overlaps or duplicates
   # it converts everything to text first and it considers the first row as headers (and not real data)
    conn.execute(
        "CREATE OR REPLACE TABLE raw_input AS "
        "SELECT * FROM read_csv_auto(?, header=true, all_varchar=true)",
        [str(input_path)],
    )
    # Counts how many rows are uploaded in the temp table
    return _fetch_scalar(conn, "SELECT count(*) FROM raw_input")

"""
Clean up Step 2: Cleaning the Raw IGA Data

Uses the raw IGA data loaded in Step 1 and turns it into the standard format for fct_product_prices. Produces the following columns:

*   `product_id`, `category_id`, `retailer_id`: joined with dim tables to get information
*   `item_name`: product name with extra spaces removed
*   `special_text`: promotional label shown on the IGA website (e.g. 'Special', 'Save $1.00'), blank if no promotion is running
*   `product_url`: product page link built by combining the IGA website address with the product ID (e.g. https://www.igashop.com.au/product/764109)
*   `price`: current selling price converted into a number
*   `unit_price`: price per standard unit such as per 100g or per litre, it was extracted from the IGA string or calculated from the price and unit size if blank
*   `is_on_special`: True if IGA marks the product as a temporary price reduction, otherwise False
*   `recorded_at`: date and time the price was recorded on the IGA website
*   `created_at`: date and time this record was saved into the database

Only keeps rows where both the product name and barcode are present. If anything is missing, it's either dropped before uploading to the final database.
"""

# After loading data, cleans it!
def _transform_data(
    conn: duckdb.DuckDBPyConnection
    , settings: AppSettings
) -> int:
    # Attach PostgreSQL so DuckDB can join against silver dim tables
    conn.execute(f"ATTACH 'host={settings.postgres_host} port={settings.postgres_port} dbname={settings.postgres_database} user={settings.postgres_user} password={settings.postgres_password}' AS pg (TYPE postgres, READ_ONLY);")

    # Runs the shared file that cleans the data and produces a summary file
    conn.execute(TRANSFORM_SQL)
    
    conn.execute("DETACH pg;")
    # Returns how many rows were created after cleaning
    return _fetch_scalar(conn,
                         "SELECT count(*) FROM normalized_products_base")

"""
### Clean Up Step 3: Checking Data Quality Before Saving

Runs the quality check file vs. the cleaned data to make sure everything is good to go before anything is permanently saved to the database.
"""

# Checks if the cleaned data passes the quality check before saving to the database
# If anything fails, the pipeline stops and reports what went wrong
def _run_quality_checks(conn: duckdb.DuckDBPyConnection) -> None:
    # Runs the quality check SQL file vs. the cleaned data
    conn.execute(QA_CHECK_SQL)
    # Gets the results of each check, with the failed ones first
    qa_results = conn.execute(
        "SELECT check_name, passed, details FROM qa_results ORDER BY passed ASC, check_name ASC"
    ).fetchall()
    # Filters only the checks that failed
    failed_checks = [row for row in qa_results if not row[1]]
    # Error message and details when failed
    if failed_checks:
        formatted = "; ".join(f"{name}={details}" for name, _, details in failed_checks)
        raise RuntimeError(f"QA checks failed: {formatted}")

"""
Upload: Saving the Cleaned Data to the Database

Copies the cleaned IGA data from the temporary table into the PostgreSQL database.

If data for the same retailer and date already exists in the database, it gets replaced so that there are no duplicates.

Note: `retailer_id` is currently blank (pending DE team discussion)
"""
# Saves the cleaned data into the database (after validation!)
def _save_data(
    conn: duckdb.DuckDBPyConnection,
    settings: AppSettings,
    run_date: str,
) -> int:
    # Copies the cleaned summary table from the temporary DuckDB space
    # into the PostgreSQL database
    # If data for the same retailer and date already exists, it gets replaced (no duplicates!)
    load_demo_slice(
        conn=conn,
        settings=settings,
        # Table in the temporary DuckDB workspace
        duck_table="demo_product_pricing_summary",
        # Table in the final PostgreSQL database
        postgres_table="demo_product_pricing_summary",
        # only saves IGA rows --- WE NEED TO SET RETAILER ID
        retailer="IGA",
        run_date=run_date,
    )

    # Copies the cleaned IGA data from the temporary DuckDB space
    # into the PostgreSQL database
    # If data for the same retailer and date already exists, it gets replaced (no duplicates!)
    rows_saved = load_demo_slice(
        conn=conn,
        settings=settings,
        duck_table="fct_product_prices_staging",
        postgres_table="fct_product_prices",
        retailer="IGA",
        run_date=run_date,
    )

    return rows_saved

"""
Execution: Running the Full IGA Pipeline

Runs the steps for every date in the requested date range, one day at a time. Only accepts `iga` as the model.

For each date it:

*   Looks for the IGA CSV file for that date so that if no file is found, the date is logged as skipped and the pipeline continues
*   Runs the steps: load, clean, quality check, and save
*   Stops immediately and reports the error if any step fails

Returns a summary at the end showing which dates were processed, which were skipped, and how many rows were produced for loading, cleaning and checking.
"""
# runs the full IGA pipeline
def run(
    model: str,
    start_date: str,
    end_date: str | None,
    runtime_config: RuntimeConfig,
    settings: AppSettings,
) -> JobSummary:
    # Makes sure the pipeline is only being run for IGA
    if model != "products_iga":
        raise ValueError("The IGA workflow supports only model='products_iga'.")

    counts = {
        # Rows from the raw CSV
        "raw_input": 0,
        # Rows after cleaning and filtering
        "normalized_products_base": 0,
        # Rows saved to the database
        "fct_product_prices": 0,
    }
    # Keeps track of which dates completed successfully and which were skipped
    processed_dates: list[str] = []
    skipped_dates: list[str] = []

    conn = duckdb.connect()
    try:
        # Loops through every date between the start and end date one by one
        for run_date in iter_dates(start_date, end_date):
            run_date_value = run_date.isoformat()
            # Finds the CSV file for this date
            input_path = resolve_input_path(
                runtime_config, model, RUNNER, run_date
            )
            # If no file exists for this date, mark it as skipped
            if not input_path.exists():
                skipped_dates.append(run_date_value)
                continue

            # Step 1: Load the source CSV into a raw staging table
            counts["raw_input"] += _load_input_file(conn, input_path)

            # Step 2: Normalise IGA columns and build the downstream summary tables
            counts["normalized_products_base"] += _transform_data(
                conn
                , settings
            )

            # Step 3: Fail fast if the transformed slice does not meet QA rules
            _run_quality_checks(conn)

            # Step 4: Persist the validated slice to PostgreSQL
            counts["fct_product_prices"] += _save_data(
                conn, settings, run_date_value
            )
            processed_dates.append(run_date_value)
    finally:
      # Closes the duckDB workspace
        conn.close()
    # Returns a summary of the run showing which dates were processed,
    # which were skipped, and how many rows were handled at each step
    return {
        "processed_dates": ",".join(processed_dates) if processed_dates else "none",
        "skipped_dates": ",".join(skipped_dates) if skipped_dates else "none",
        "counts": counts,
    }
