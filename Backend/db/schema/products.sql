-- App-owned product metadata only.
-- Canonical product and pricing data is owned by DE in the `silver` schema
-- (silver.dim_products, silver.fct_product_prices) — see Adriana's
-- FINALISED_POSTGRESQL_SCHEMA.md (feature/ad-be-t2-migration-reconciliation).
-- App Dev does NOT own or duplicate product/pricing tables. This table holds
-- only presentation/API fields that don't belong in DE's canonical dimension,
-- joined to silver.dim_products via a shared UUID (logical FK, not physical --
-- so DE can manage Silver independently).

CREATE TABLE app.product_metadata (
    product_id          UUID PRIMARY KEY,  -- logical FK to silver.dim_products.id
    description         TEXT,
    image_link_primary   TEXT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Note: image_link_primary remains here until DE and App agree on image
-- ownership (see FINALISED_POSTGRESQL_SCHEMA.md, "App-owned catalogue
-- metadata" section). Do not remove pending that decision.