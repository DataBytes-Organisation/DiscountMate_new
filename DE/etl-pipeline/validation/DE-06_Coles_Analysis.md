# DE-06 – Coles Product Matching Analysis

## Purpose

Analyse the current Coles product matching flow in the ETL pipeline and validate the existing implementation before making any production SQL changes.

This work supports **DE-06 – Product Matching & Deduplication (Silver Layer)**.

---

## Platform Context

Retailer Websites
↓
DE/ingestion-pipeline
↓
Bronze CSV Files
↓
DE/etl-pipeline
↓
transform.sql (normalisation)
↓
canonical_key generation
↓
sync_dim_products.sql
↓
silver.dim_products
↓
Analytics / ML / Backend

The ETL pipeline is responsible for schema mapping, validation, product matching, deduplication, and loading into the Silver layer.

---

## Relevant Silver Tables

| Table | Purpose |
|-------|---------|
| silver.dim_products | Canonical product dimension |
| silver.fct_product_prices | Historical price observations |
| silver.dim_retailers | Retailer reference table |
| silver.dim_categories | Category reference table |
| silver.static_master_coles_products | Coles GTIN reference table |

---

## Current Matching Flow

The current Coles workflow performs the following:

1. Normalise retailer product data (`transform.sql`)
2. Generate canonical_key
3. Read latest Coles GTIN reference
4. Join categories
5. Match by GTIN
6. Match by canonical_key
7. Detect unmatched products
8. Generate new product identities
9. Resolve GTIN conflicts
10. Sync into silver.dim_products

---

## Canonical Key

The canonical key is generated during `transform.sql` using:

- Normalised brand name
- Normalised product name
- Pack quantity
- Pack unit

It is later used by `sync_dim_products.sql` as the fallback matching mechanism after GTIN matching.

---

## Existing Matching Logic

### GTIN Matching

Matches products when GTIN exists.

### Canonical Matching

Matches products using the generated canonical key.

### Duplicate Handling

Duplicate canonical keys within the same ETL batch are assigned a shared product identity before insertion.

---

## Initial Data Investigation

The raw Coles MongoDB collection was inspected.

Available fields include:

- product_code
- item_name
- category
- item_price
- unit_price
- timestamp

GTIN, canonical_key, pack_quantity and normalised brand fields are not present in the raw collection, indicating these attributes are generated or enriched during the ETL process.

---

## DE-06 Requirements

| Requirement | Status |
|------------|--------|
| GTIN-first matching | Implemented |
| Canonical fallback | Implemented |
|Name + Brand + Pack similarity | Partially implemented through canonical_key; needs validation
| Near duplicate handling | Needs validation |
| Cross-retailer validation | Pending |

---

## Potential Gaps Requiring Validation

- Unit normalisation (1L vs 1000ml)
- Pack wording (6 pack vs 6pk)
- Brand spelling differences
- Missing GTIN
- Similar names with different pack sizes
- Near duplicates across retailers

---

## Validation Plan

- Validate current canonical matching using real Coles data.
- Identify any edge cases.
- Propose one targeted improvement only if supported by evidence.
- Test the updated logic before opening a Pull Request.

---

## Validation Results

Validation was performed against the Silver layer after loading the Coles dataset.

### Findings

- 14,578 products were loaded into `silver.dim_products`.
- No duplicate products were found for the combination of product name, brand name, pack quantity, and pack unit.
- Products sharing the same name (for example, Full Cream Milk and Extra Virgin Olive Oil) are correctly separated by brand and pack size.
- Multiple pack-size variants are preserved as separate canonical products.
- GTIN values are currently not populated in `silver.dim_products`, so GTIN-first matching could not be validated using the current Silver dataset.