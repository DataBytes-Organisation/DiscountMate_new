# DE-06 – Coles Product Matching & Deduplication

## 1. Overview

This document describes the Coles implementation for DE-06 Product
Matching & Deduplication in the Silver-layer ETL pipeline.

The objective is to ensure that repeated observations of the same Coles
product are reduced to a deterministic canonical product identity before
the product data is synchronised into `silver.dim_products`.

The implementation focuses on:

- deterministic product identity generation;
- duplicate removal during the ETL transform step;
- preservation of legitimate product variants;
- deterministic conflict handling;
- validation of the resulting canonical identities.

---

## 2. Product Matching Strategy

The implementation uses a hierarchical approach.

### Primary identifier – GTIN

GTIN is the preferred product identifier when it is available in the
source data and populated in the Silver product dimension.

For the current Coles dataset, GTIN values are not populated in
`silver.dim_products`. Therefore, GTIN-first matching cannot currently
be validated against the available Coles Silver data.

This is treated as a data-availability limitation rather than an
assumption that another identifier is a GTIN.

### Deterministic fallback identity

When GTIN is unavailable, the Coles transform generates a canonical
identity using:

1. normalised brand name;
2. normalised product name;
3. normalised pack quantity;
4. normalised pack unit.

The resulting key is:

    brand_name_key
    + product_name_key
    + pack_quantity_key
    + pack_uom

Example:

    mount franklin|lightly sparkling|1.25|l

This approach makes equivalent textual representations more consistent
while preserving meaningful product differences such as brand and pack
size.

---

## 3. Normalisation

Product names and brands are normalised before the canonical key is
created.

The transformation:

- converts text to lowercase;
- removes non-alphanumeric characters;
- replaces them with spaces;
- trims unnecessary whitespace.

Pack quantities are converted to a numeric representation and formatted
into a stable key.

Pack units are standardised, including examples such as:

- gram / grams → `g`
- kg / kilo / kilos → `kg`
- ml → `ml`
- litre / liter / ltr / lt → `l`
- each → `ea`
- pk → `pack`

This reduces formatting differences between observations of the same
product.

---

## 4. ETL Deduplication Logic

The DE-06 deduplication logic is implemented in:

    features/products/coles/workflow_sql/transform.sql

The transform first constructs the canonical product key and then
deduplicates observations using:

    raw_product_id
    + canonical_key
    + source_file

`recorded_at` is deliberately excluded from the deduplication partition.

This prevents repeated observations of the same product within one source
file from creating multiple normalized records.

Historical source files remain separate so that valid observations from
different scrape batches are not incorrectly collapsed.

---

## 5. Deterministic Conflict Handling

When multiple observations have the same:

    raw_product_id
    + canonical_key
    + source_file

the transform uses:

    recorded_at DESC
    price ASC

as the deterministic ordering.

Therefore:

1. the most recent observation is preferred;
2. if timestamps are identical, the lower price is selected as the
   deterministic tie-breaker.

This ensures repeatable ETL behaviour and avoids nondeterministic
duplicate selection.

---

## 6. Legitimate Variants Are Preserved

The implementation does not merge products solely because they have a
similar name.

Brand and pack information remain part of the canonical identity.

For example, products such as:

    Coles Full Cream Milk 1L
    Coles Full Cream Milk 2L

remain separate because their pack quantities differ.

Similarly, products with the same product name but different brands are
kept as separate canonical products.

This prevents incorrect price histories from being combined.

---

## 7. Near-Duplicate Handling

The current implementation uses deterministic normalisation rather than
automatic fuzzy matching.

This is intentional.

Automatic fuzzy matching could incorrectly merge commercially different
products, particularly when products differ by:

- pack size;
- brand;
- product variant;
- flavour;
- formulation.

Potential near-duplicate candidates are therefore identified through
validation queries and can be reviewed before any future fuzzy matching
rule is introduced.

This provides a safer production approach for DiscountMate because an
incorrect product merge could associate the wrong price history with a
product.

---

## 8. Validation

The Coles validation script is:

    validation/de06_coles_matching_validation.sql

The validation checks:

1. GTIN coverage;
2. duplicate canonical products;
3. products sharing the same name;
4. representative product matching cases;
5. pack-size variants;
6. brand variants;
7. products without GTIN.

The validation script is read-only and does not modify production data.

---

## 9. Validation Evidence

The available Coles validation evidence shows:

- 14,578 products were loaded into `silver.dim_products` during the
  validation run;
- no duplicate products were found for the combination of product name,
  brand name, pack quantity and pack unit;
- products sharing the same name are separated by brand and/or pack size;
- multiple pack-size variants are preserved as separate canonical
  products;
- GTIN values were not populated in the available Silver dataset, so
  GTIN-first matching could not be exercised against this dataset.

The current ETL transform was also executed successfully for the Coles
dataset over the requested date range.

Latest pipeline execution:

    model=products_coles
    start_date=2026-01-01
    end_date=2026-05-04
    raw_input_rows=232439
    raw_input_normalized_rows=186723

The pipeline completed successfully.

---

## 10. Cross-Retailer Consideration

The canonical-key design is intentionally retailer-independent:

    brand + product name + pack quantity + pack unit

This allows the same identity strategy to be applied across retailers
while retaining retailer-specific source processing.

The current Coles implementation has been validated independently against
the Coles dataset.

A full two-retailer end-to-end validation requires executing the same
identity checks against another retailer's populated Silver data. No
cross-retailer result is claimed here where execution evidence is not
available.

---

## 11. Acceptance Criteria Status

| Acceptance criterion | Status | Evidence |
|---|---|---|
| Matching products use a deterministic canonical identity | PASS | Normalised brand + product name + pack quantity + pack unit |
| Duplicate observations are removed during ETL | PASS | `raw_product_id + canonical_key + source_file` deduplication |
| Near-duplicates are identified safely | PASS | Validation queries identify same-name/brand/pack candidates |
| Different brands remain separate | PASS | Brand is included in canonical identity |
| Different pack sizes remain separate | PASS | Pack quantity and pack unit are included |
| Deterministic conflict handling | PASS | `recorded_at DESC`, then `price ASC` |
| No duplicate canonical products in Coles validation | PASS | Validation evidence |
| GTIN-first matching | LIMITED | GTIN is not populated in the available Coles Silver data |
| Automatic fuzzy merging | NOT USED | Intentionally avoided to prevent false product merges |
| Coles ETL execution | PASS | Pipeline completed successfully |

---

## 12. Engineering Decision

For the current Coles data, deterministic matching is preferred over
automatic fuzzy matching because it provides:

- reproducibility;
- explainability;
- predictable ETL behaviour;
- protection against incorrect product merges;
- compatibility with downstream price-history analysis.

GTIN-based matching can be enabled when a reliable GTIN field becomes
available in the source-to-Silver data flow.

Future fuzzy matching can be introduced as a separate candidate-review
layer rather than directly merging products in the production transform.