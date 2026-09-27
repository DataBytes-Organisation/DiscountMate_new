---
title: Validation & Results
sidebar_label: Validation & Results
sidebar_position: 3
---

# Validation & Results

The matching/dedup logic was validated end to end against real sample data for two retailers.

## Downloads

- **[Full matching-rules documentation](https://deakin365.sharepoint.com/:w:/r/sites/DataBytes2/Shared%20Documents/Project%20-%20DiscountMate/T2%202026/DE/DE-06_Documentation_Aldi__IGA.docx?d=w3e350d0d1d754f61aff7938b1512cc2d&csf=1&web=1&e=oWtEft)** - the complete write-up with code walkthroughs and worked examples.
- **[Validation query set (SQL)](https://deakin365.sharepoint.com/:w:/r/sites/DataBytes2/Shared%20Documents/Project%20-%20DiscountMate/T2%202026/DE/DE-06_Documentation_Aldi__IGA.docx?d=w3e350d0d1d754f61aff7938b1512cc2d&csf=1&web=1&e=oWtEft)** - the checks below, runnable against the loaded `silver` schema.

## Results - IGA (sample date 2026-04-06)

- **Deduplication:** 20,383 raw rows → 20,205 canonical products (178 collapsed by matching).
- **Barcode coverage:** 17,514 / 20,205 (87%) carried a GTIN.
- **No insert failures:** the load completed with no two products sharing a barcode.
- **Safe to re-run:** a second identical load left the product count unchanged (20,205 → 20,205).

## Results - Aldi (sample date 2026-05-04)

- **Deduplication:** 6,624 raw rows → 2,801 canonical products (multi-category repeats merged).
- **No insert failures** on the first load; all pack units valid.
- **Cross-retailer:** with IGA and Aldi both loaded, 2 products matched across both retailers
  (barcode reference table was empty, so matching relied on the brand-stripped canonical key alone).

## How to validate a load yourself

```bash
docker exec -i discount_mate_etl_postgres psql -U postgres -d discountmate < DE-06_validation.sql
```

The script checks GTIN uniqueness, canonical-key duplicates, fact-table integrity, match-rate
coverage, and cross-retailer consolidation. See the SQL download above for the full set.

**Page last modified:** 19/09/2026 (Margie Licup)
