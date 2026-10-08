---
title: Matching & Deduplication Rules
sidebar_label: Matching Rules
sidebar_position: 2
---

# Matching & Deduplication Rules

## Identity fields

Every normalised row carries these identity fields, built in `transform.sql`:

| Field | Meaning |
|---|---|
| `match_gtin` | The product barcode (longest valid 8–14 digit value found). |
| `brand_name` | Brand, normalised (lower-cased, punctuation collapsed). |
| `product_name` | Product name, normalised and **brand-stripped** (a leading whole-word brand is removed). |
| `pack_quantity` / `pack_uom` | Pack size and unit, mapped to the allowed set `g, kg, ml, l, ea, pack, m`. |
| `canonical_key` | `brand \| core-name \| pack-qty \| pack-uom` - the non-barcode identity string. |

## Matching rule ladder (highest confidence first)

1. **GTIN (barcode) match** - if the barcode matches an existing product, reuse it. *Strongest signal.*
2. **Canonical-key match** - otherwise, match on `brand + name + pack + unit`.
3. **Batch group collapse** - new rows in the same load that share a canonical key resolve to **one** new product (not one each).
4. **New product** - if nothing matches, create a new canonical record.

:::note Aldi has no barcodes
Aldi's Bronze data carries no GTIN, so before the ladder runs its transform borrows a barcode
from the Coles reference table (`static_master_coles_products`) using a tiered fuzzy match
(exact → core+size → core+pack → Jaro-Winkler), accepted only when it resolves to exactly one
GTIN. This is what lets an Aldi product join the same identity as the Coles/IGA product.
:::

## Deduplication (T2)

- **Within a batch** - `row_number()` keeps one row per product per scrape, removing multi-category repeats.
- **Across batches** - the identity ladder above maps repeat observations onto the existing product, so re-running a load updates rather than inserts.

## Worked example

| Scenario | Result |
|---|---|
| `"Bega Peanut Butter"` (brand Bega) | Brand stripped → stored as `Peanut Butter`; key `bega\|peanut butter\|470\|g`. |
| Same product from IGA (`Peanut Butter`) and Aldi (`Bega Peanut Butter`) | Both produce the same canonical key → **one** record. |
| `"Peanut Butter"` by Bega vs by Coles (no barcode) | Different brand → **kept separate** (correct). |

See **[Validation & Results](./validation-and-results.md)** for the measured outcomes and
**[Limitations](./limitations.md)** for edge cases.

**Page last modified:** 19/09/2026 (Margie Licup)