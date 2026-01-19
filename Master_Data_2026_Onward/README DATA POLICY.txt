DISCOUNTMATE - DATA USAGE POLICY AND GUIDELINES (2026 ONWARD) 

Version: 0.1
Date: 05/01/2026

This document outlines high-level data usage principles for the DiscountMate project.
A more comprehensive Word/PDF data governance document (including MongoDB policy) will be produced in T3 2025 and uploaded to this folder (R.D.L. to advise).

___________________________________________________________________________________________________________________________________
BACKGROUND & RATIONALE

As of T3 2025, following multiple trimesters of Capstone A and B, the repository contains 200+ CSV files and dataset splits created during exploratory work which has led to:

--> duplication of datasets,

--> unclear data provenance,

--> increased onboarding effort for new cohorts,

--> and non-value-adding time spent rediscovering or reconciling data.

The Master_Data_2026_Onward folder is introduced to establish a single source of truth for core datasets going forward.

___________________________________________________________________________________________________________________________________
INTENDED FILE STRUCTURE

>> MAIN_TABLE1(provisioned) final_master_table: all products description, pricing tagged by store. This should power all data to the website.

>> MAIN_TABLE2(provisioned) historic_data: all tracked scrapes or all tracked catalogues. This should power all analysis and ML efforts. No subsetting to be committed see rules below.  

Other tables to assist development and processing for the above tables:

> Master_coles_scrape.csv: This file contains a full scrape of 26,000 product URLs extracted over 28/12/2025-04/01/2026. This was required to gain additional product details for the previously scraped products to allow easier relation and tracking across stores using brands/categories. This scrape also allowed for the download of +61,000 product images from /wcsstore/Coles-CAS/images/. This processed utilised paid ScraperAPI subscription ($80) and is intended to a be one time scrape for the purpose of extracting more detailed product information.

> (Provisioned) all_scraped_products.csv
To consolidate all retailer scrapes into a unified master table.

> (Provisioned) cleaned_master_products.csv Post-processing and standardisation a new dataset now that master coles scrape has been completed.

> (Provisioned) catalogue OCR extraction outputs - for historic data

> (Not included here) Catalogue tracking is maintained separately at:Catalogue_Scraping_2025/catalogue_data/catalogue_tracking.csv
___________________________________________________________________________________________________________________________________
CORE DATA USAGE AND POLICY

- Do not commit (via GitHub PR's) derived or sliced datasets
- Exploratory subsets must be created programmatically inside scripts or notebooks.
- Pull requests containing derived CSVs should be rejected.
- Always start from the master dataset
- Data transformations, filtering, and splits must be shown in code to ensure reproducibility.
- Local-only saves are permitted for development
- If saving locally for offline work, retain the full transformation logic.
- Before submission, comment out local file reads and ensure the workflow executes from master data.

Accessing Data in Python (Pandas)
Recommended (run from repository root)
import pandas as pd
df = pd.read_csv("Master_Data_2026_Onward/Master_coles_scrape.csv")

If running from a subfolder

Example: script located at ML/Price-Prediction/train.py

df = pd.read_csv("../Master_Data_2026_Onward/Master_coles_scrape.csv")
___________________________________________________________________________________________________________________________________
MONGODB USAGE POLICY **MONGO DETAILS SHOULD NEVER BE EXPOSED OR UPLOADED IN A .PY OR .IPYNB PULL REQUEST***

Ensure mongo credentials are maintained in your .env file and access or call to mongo via this .env file. 
More instructions and policies on accessing mongo directly for working with .py or .ipynb scripts to come in T3 2025.
