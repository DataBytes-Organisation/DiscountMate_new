# Product Matching (DiscountMate) — README

This module implements a scalable **cross-store product matching / identity resolution** workflow for DiscountMate. The goal is to map each scraped product record to the correct **master SKU** (DiscountMate product ID) despite inconsistent naming, ordering, and unit formats across retailers.

The approach is designed to be **fast, explainable, and tunable**:
- **Brand blocking** reduces the search space.
- **ANN candidate retrieval** (TF-IDF + cosine nearest neighbours) avoids brute-force pairwise comparison.
- A **multi-metric ensemble** produces two match modes:
  - **True match** (strict identity matching)
  - **Variant match** (more tolerant matching for retailer-specific variants)

---

## What problem this solves

Retailer catalogues describe the same real-world products using inconsistent text:
- Different wording: *“Fries” vs “Chips”*
- Different descriptors: *“Extra Crispy”* present or missing
- Different unit formatting: *“750 g” vs “750g”*, etc.

Exact string matching fails, and single similarity metrics can be either too strict or too permissive. This module creates a consistent, repeatable way to assign scraped products to stable master identities for:
- longitudinal price tracking
- discount detection
- analytics reliability
- reducing duplicate product proliferation

---

## Method summary

### 1) Canonical product text (“canon”)
For each row, we build a canonical text representation that preserves whitespace for NLP:

- **Master canon**: `brand + name + size`
- **Scraped canon**: `brand + item_name + approx_item_size + base_unit`

Whitespace is preserved to support tokenization (Jaccard), TF-IDF, and other text techniques.

### 2) Blocking (brand)
Matching is run inside brand blocks (`brand_clean`) instead of comparing everything to everything.

### 3) Candidate retrieval (ANN)
Within a brand block:
- build TF-IDF vectors on master canon (1–2 grams)
- use cosine NearestNeighbors to retrieve **top-K candidate** master products per scraped product

### 4) Ensemble scoring (two modes)
Each candidate is scored with three components:
- `CHAR`: RapidFuzz `token_set_ratio` (robust to word order and minor edits)
- `JACC`: Jaccard overlap of token sets
- `COS`: TF-IDF cosine similarity from ANN retrieval

Two tunable scoring modes are computed:

**True match (strict)**  
`true_score = 0.50*CHAR + 0.25*JACC + 0.25*COS`

**Variant match (flexible)**  
`variant_score = 0.30*CHAR + 0.20*JACC + 0.50*COS`

### 5) Acceptance rule (threshold + margin)
A match is accepted only if:
- best score ≥ threshold, **and**
- best score − second best score ≥ margin

This reduces false positives and flags ambiguous cases safely.

---

## Repository contents

- `product_matching.py`  
  Main script: builds canon strings, runs per-brand candidate retrieval, computes true/variant scores, outputs results.

Outputs:
- `matches_out.csv` — row-level match results (including top-2 candidates and scores)
- `matches_summary.csv` — acceptance rates per brand (true vs variant)

---

## Requirements

Python 3.9+ recommended.

Install dependencies:

```bash
pip install pandas numpy scikit-learn rapidfuzz

# Running the Script

The script is executed from the command line and accepts configurable arguments.

## Basic Usage
# Create data folder and add input files / within same folder 
# Create output folder, called result 
```bash
python product_matching.py \
  --master_csv "Master_Coles_Scrape.csv" \
  --scraped_csv "preprocessed_dataset 2.csv"


## Advanced Usage

python product_matching.py \
  --master_csv "Master_Coles_Scrape.csv" \
  --scraped_csv "preprocessed_dataset 2.csv" \
  --top_k 10 \
  --top_brands 15 \
  --true_threshold 0.90 \
  --true_margin 0.05 \
  --variant_threshold 0.88 \
  --variant_margin 0.03

| Parameter             | Type   | Required | Default | Description                                                                            |
| --------------------- | ------ | -------- | ------- | -------------------------------------------------------------------------------------- |
| `--master_csv`        | string | Yes      | –       | Path to master catalogue CSV file                                                      |
| `--scraped_csv`       | string | Yes      | –       | Path to scraped dataset CSV file                                                       |
| `--top_k`             | int    | No       | 10      | Number of nearest master candidates retrieved per scraped product (ANN retrieval size) |
| `--top_brands`        | int    | No       | 10      | Number of brands (by scraped frequency) to process                                     |
| `--true_threshold`    | float  | No       | 0.90    | Minimum ensemble score required for strict identity match                              |
| `--true_margin`       | float  | No       | 0.05    | Minimum difference between best and second-best score for strict match acceptance      |
| `--variant_threshold` | float  | No       | 0.88    | Minimum ensemble score required for variant match                                      |
| `--variant_margin`    | float  | No       | 0.03    | Minimum margin required for variant acceptance                                         |

