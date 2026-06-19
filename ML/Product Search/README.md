# Product Search Module — README

This module provides a lightweight **catalogue search and keyword intelligence** workflow on top of the DiscountMate master catalogue. It is intended for fast exploration of product text, category-level keyword discovery, and coverage reporting (how well a keyword captures products within one or more categories).

It complements the **product matching** pipeline by helping the team:
- decide which keywords are useful for category-aware search,
- understand which terms are shared across categories (low specificity),
- identify unique terms that best describe each category,
- quantify how many products would be returned by a keyword-driven query.

---

## What problem this solves

When the catalogue grows, teams typically need:
- a quick way to search products without heavy infrastructure,
- a method to extract category-defining keywords,
- evidence-based keyword lists to guide scraping rules, filtering, or UI search,
- “coverage” metrics that quantify how broad or narrow a keyword is.

This script uses **TF-IDF** and simple reverse counting to provide these signals in a transparent way.

---

## Key scenarios where this code is useful

### 1) Category-aware keyword selection
Example: You want 1–3 keywords per `merchandise_category` to drive search or filtering.
- Output: Top TF-IDF terms per category, plus their product coverage.

### 2) Measure how “broad” a keyword is across categories
Example: Terms like `pack`, `coles`, `fresh` appear everywhere and are not helpful for precise search.
- Output: For each keyword, top categories where it appears and coverage % per category.

### 3) Identify unique/category-defining terms
Example: Find words that strongly identify a category and rarely appear elsewhere.
- Output: Candidate “unique” keywords by category, ranked by TF-IDF and uniqueness.

### 4) Build a quick “search impact” view
Example: Before using a keyword list in production, estimate:
- How many products will match each keyword?
- Which categories will be impacted most?

### 5) Support blocking / narrowing strategies for matching
Example: Use category or keyword signals as an additional filter before doing expensive similarity matching.
- Output: Keywords with high category coverage can be used as coarse filters; high specificity terms can help disambiguate.

---

## Requirements

Python 3.9+ recommended.

Install dependencies:

```bash
pip install pandas numpy scikit-learn

python product_search.py \
  --master_csv "Master_Coles_Scrape.csv" \
  --category_col "merchandise_category"

python product_search.py \
  --master_csv "Master_Coles_Scrape.csv" \
  --category_col "merchandise_category" \
  --text_cols brand name description size \
  --top_terms_global 20 \
  --top_terms_per_category 3 \
  --min_df 3 \
  --max_df 0.7 \
  --shared_min_categories 3 \
  --top_categories_per_keyword 3
```


# Command Line Parameters

| Parameter | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--master_csv` | string | No | `Master_Coles_Scrape.csv` | Master catalogue CSV filename (loaded from `./data/<master_csv>` relative to the script location). |
| `--query` | string | No | `None` | Search query string. If provided, the script runs **Search mode** and returns top matches from the master catalogue using TF-IDF cosine nearest neighbours. |
| `--top_k` | int | No | `10` | Number of top results returned in **Search mode** (top-K nearest neighbours). |
| `--do_keywords` | flag | No | `False` | If set, runs **Keyword analysis mode** (TF-IDF keyword exploration + coverage reporting). |
| `--category_col` | string | No | `merchandise_category` | Category column used to group products for per-category TF-IDF keywords and coverage analysis. Must exist in the master CSV. |

## Notes on Modes

**Search mode** runs when `--query` is provided.  
  Example:
  ```bash
  python product_search.py --master_csv "Master_Coles_Scrape.csv" --query "mccain pub style fries 750g" --top_k 10
