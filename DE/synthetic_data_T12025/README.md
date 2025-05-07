# Project Overview

This repository contains five main scripts to simulate, dirty, clean, load, and export sample data for the DiscountMate project. Follow the workflow summary at the end to run end-to-end.

---

## Generate clean synthetic data
**File:** `app.py`

**Purpose:**
- Create clean, synthetic CSV files for Users, Stores, Products, Product Pricing, Baskets, Shopping Lists, and Shopping List Items.

**Dependencies:**
- Python 3.x
- `pandas`
- `faker`
- `uuid`

**Usage:**
1. Install dependencies:
   ```bash
   pip install pandas faker
   ```
2. Run:
   ```bash
   python app.py
   ```
3. The following files will be generated:
   - `users.csv`
   - `stores.csv`
   - `products.csv`
   - `product_pricing.csv`
   - `baskets.csv`
   - `shopping_lists.csv`
   - `shopping_list_items.csv`

---

## Introduce dirty data
**File:** `create_dirty_data.py`

**Purpose:**
- Take the clean CSVs and add noise:
  - Randomly insert NULL/NaT
  - Wrap strings with extra whitespace
  - Duplicate random rows
  - Add one redundant column per table prefixed `redundant_`

**Dependencies:**
- Python 3.x
- `pandas`
- `numpy`

**Usage:**
1. Ensure clean CSV files exist.
2. Install dependencies:
   ```bash
   pip install pandas numpy
   ```
3. Run:
   ```bash
   python create_dirty_data.py
   ```
4. Dirty CSVs with suffix `_dirty.csv` will be created.

---

## Clean dirty data in PostgreSQL
**File:** `clean.sql`

**Purpose:**
- In PostgreSQL, process each `_dirty` table to:
  1. Trim whitespace and fill default values
  2. Drop columns named `redundant_*`
  3. Rename clean tables back to original names
  4. Drop dirty tables

**Usage:**
1. Connect to your DB (e.g. `psql`).
2. Execute:
   ```sql
   \i path/to/clean.sql
   ```
3. Confirm the tables (`users`, `stores`, etc.) contain only cleaned data.

---

## Load cleaned data into MongoDB
**File:** `push_to_mongo.py`

**Purpose:**
- Read cleaned CSVs and upsert documents into MongoDB collections by `_id`, overwriting old entries or inserting new ones.

**Dependencies:**
- Python 3.x
- `pandas`
- `pymongo`
- `python-dotenv`

**Configuration:**
- Set in your environment or `.env`:
  ```bash
  export MONGO_URI='mongodb+srv://<user>:<pass>@cluster'
  export MONGO_DB='SampleData'
  ```

**Usage:**
1. Install dependencies:
   ```bash
   pip install pandas pymongo python-dotenv
   ```
2. Run:
   ```bash
   python push_to_mongo.py
   ```
3. The script will upsert each CSV into its corresponding collection.

---

## Export a sample subset from MongoDB
**File:** `export_collection.py`

**Purpose:**
- Connect to MongoDB and export the first N documents (default 50) of a specified collection to CSV.

**Dependencies:**
- Python 3.x
- `pandas`
- `pymongo`

**Configuration:**
- In the script, adjust or set via environment:
  - `MONGO_URI`
  - `DB_NAME`
  - `COLLECTION_NAME`
  - `MAX_ROWS`

**Usage:**
1. Install dependencies:
   ```bash
   pip install pandas pymongo python-dotenv
   ```
2. (Optional) Set `MONGO_URI` in environment:
   ```bash
   export MONGO_URI='mongodb+srv://<user>:<pass>@cluster'
   ```
3. Run:
   ```bash
   python export_collection.py
   ```
4. Results will be in `<COLLECTION_NAME>.csv` with up to `MAX_ROWS` rows.

---

# Workflow Summary
1. **Generate** clean data: `app.py`
2. **Dirty** data: `create_dirty_data.py`
3. **Clean** data: `clean.sql`
4. **Load** into MongoDB: `push_to_mongo.py`
5. **Export** subset: `export_collection.py`


