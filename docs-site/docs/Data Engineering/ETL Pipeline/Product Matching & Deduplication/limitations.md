---
title: Limitations & Conflict Handling
sidebar_label: Limitations
sidebar_position: 4
---

:::info Ticket Reference
**Ticket:** DE-06 - Product Matching & Deduplication (Silver Layer)  
**Sub-tasks:** DE-06-T3 (conflicts / near-duplicates)  
**Owner:** _TBD_ - **Status:** ✅ Done (IGA, Aldi)  
**Full scope on Planner:** [T2 2026 - DiscountMate](https://teams.microsoft.com/l/entity/com.microsoft.teamspace.tab.planner/mytasks?tenantId=d02378ec-1688-46d5-8540-1c28b5f470f6&webUrl=https%3A%2F%2Ftasks.teams.microsoft.com%2Fteamsui%2FpersonalApp%2Falltasklists&context=%7B%22subEntityId%22%3A%22%2Fv1%2Fplan%2FW4GVIlc9ekm3v0KtLqyCpsgAEMDA%22%7D)
:::

# Limitations & Conflict Handling

## Conflict handling that IS in place (T3)

- **Single-GTIN guard** - a fuzzy/enrichment match is accepted only when it resolves to exactly one barcode.
- **Fuzzy margin guard** - a fuzzy match must clearly beat the runner-up, so near-ties don't guess.
- **Whole-word brand strip** - a brand is only removed when it's a complete leading word (prevents "Lifesavers" → "s Pastilles").
- **Merge-source collapse** - the merge writes one row per product, preventing "affected row more than once" errors.

## Known limitations

### Canonical-key vs. database index divergence (re-run risk on no-size products)
The matching logic and the database's uniqueness check build a product's identity slightly
differently (mainly in name normalisation and how a missing pack size is handled). For most
products they agree. For a few products with **no pack size**, a re-run of an already-loaded
batch can raise a duplicate-key error and roll back safely (no bad data written). The lasting fix
is to store one shared identity key as a column - a database migration.

### Blank-brand matching
Two genuinely different products that both have a blank brand can share a canonical key and
merge incorrectly. Recommended safeguard: refuse a name-based match when the brand is empty,
or route such rows to a quarantine table.

### Coverage
Full cross-retailer matching by barcode depends on the Coles reference table being seeded; when
it's empty, matching relies on name/brand/pack only, which naturally limits cross-retailer matches.

## Recommended future work

- Persist a single `canonical_key` column on `dim_products` and move the unique index onto it.
- Add a unique index on the fact table's logical key `(retailer, product, recorded_at, item_name)`.
- Add a quarantine table for ambiguous matches.

**Page last modified:** 19/09/2026 (Margie Licup)