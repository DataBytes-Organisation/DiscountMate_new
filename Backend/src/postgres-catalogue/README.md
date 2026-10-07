# PostgreSQL catalogue

This module exposes the Data Engineering catalogue beside the existing MongoDB application. It supports both the Migration PostgreSQL schema and the Finalised PostgreSQL schema. It uses a dedicated pooled TypeORM `DataSource`, does not run schema synchronisation or migrations, and starts every pooled session with `default_transaction_read_only=on`.

Both schema stages read the same canonical DE tables:

- `silver.dim_products`
- `silver.dim_categories`
- `silver.dim_retailers`
- `silver.fct_product_prices`

The App-owned presentation tables differ by schema stage:

| API value | Migration PostgreSQL | Finalised PostgreSQL |
| --- | --- | --- |
| Category presentation data | `app.category_api_compatibility` | `app.category_metadata` |
| Product presentation data | `app.product_api_compatibility` | `app.product_metadata` |
| Exact pack display unit | `source_measurement` | `pack_display_unit` |
| Runtime price presentation data | `app.product_price_source_records` | `app.product_price_metadata` |
| Exact unit-price label | `raw_unit_price` | `unit_price_label` |

At startup, the module checks which complete set of tables is present and selects the corresponding queries. It prefers the Finalised PostgreSQL read model if both complete sets are present. It marks the catalogue unavailable if the shared Silver tables are missing or neither App table set is complete. The selected model remains fixed until the backend restarts, so restart the backend after applying or reverting the finalisation migration.

## Catalogue presentation metadata

`silver.dim_products.pack_quantity` and `pack_uom` remain the canonical DE package values. The query aliases either `app.product_api_compatibility.source_measurement` or `app.product_metadata.pack_display_unit` to the same internal `pack_display_unit` field. The API response contract therefore remains identical at both schema stages. The frontend receives quantity and unit separately and formats values such as `6` plus `pack` as `6pack`.

The finalised runtime price metadata table contains only:

- `price_fact_id`
- `price_recorded_at`
- `unit_price_label`
- `best_price`
- `best_unit_price_label`
- `created_at`
- `updated_at`

At the migration stage, the equivalent values are `raw_unit_price`, `best_price`, and `raw_best_unit_price` in `app.product_price_source_records`. At either stage, the selected price metadata table joins to `silver.fct_product_prices` by `price_fact_id` and `price_recorded_at`. The query aliases the selected label to `unit_price_label`, so the rest of the API uses one contract.

The label is the complete original display string, for example `$2.50 per 100g`; the backend does not reconstruct it from the product package unit or the numeric unit-price value. This preserves the `100` and `g`. `best_price` and the best-unit-price label are retained for compatibility but are not currently exposed by the catalogue API.

After finalisation, the complete MongoDB pricing lineage is moved to `migration.product_price_source_records`. It contains source identifiers, checksums, original labels, retailer text, and source timestamps. Finalised runtime catalogue queries do not read that migration table; they read the compact `app.product_price_metadata` projection. Before finalisation, the API reads `app.product_price_source_records` because it is the migration-stage source of the same display label.

## Numeric and display price values

- `silver.fct_product_prices.price` stores the numeric observed shelf price.
- `silver.fct_product_prices.unit_price` stores the existing migration's numeric unit-price value.
- Migration PostgreSQL: `app.product_price_source_records.raw_unit_price` stores the exact source display label.
- Finalised PostgreSQL: `app.product_price_metadata.unit_price_label` stores the same exact source display label.
- Silver currently has no `best_price` or `best_unit_price` column, so the retained best-price compatibility values remain App-owned.

The migration currently extracts only the leading numeric portion of an existing label such as `0.046 per ml`. It does not create separate `unit_price_basis_uom` or basis-quantity fields, does not normalize `2.50 per 100g` into a per-gram value, and does not add any new pricing columns to the DE-owned Silver schema.

The application role must be restricted to `USAGE` and `SELECT` for the four shared Silver tables and the three App tables for the active schema stage.

The catalogue is enabled only when `POSTGRES_CATALOG_ENABLED=true`, `DE_DATABASE_URL` is configured, the four shared tables exist, and one complete three-table App read model exists. `GET /api/postgres/status` reports only `enabled` and `available`. When disabled, PostgreSQL catalogue routes return 404; when configured but unavailable, they return controlled 503/504 errors. MongoDB-backed authentication, users, carts, lists, alerts, notifications, and the normal catalogue routes remain unchanged.

Available read-only routes are:

- `GET /api/postgres/status`
- `GET /api/postgres/categories`
- `GET /api/postgres/products`
- `GET /api/postgres/search`
- `GET /api/postgres/specials`
- `GET /api/postgres/products/:id`

Responses use the frontend-compatible camelCase contract and stable DE UUIDs. Missing catalogue values are returned as `null` or unavailable; connection details and raw database errors are never sent to the frontend.

## Frontend integration note

As of 24 September 2026, the separate `/postgresproductpage` frontend route is wired to this catalogue while reusing the existing catalogue UI components: `HomeMainSection`, `SidebarCategories`, `ProductGrid`, `ProductCard`, `RetailerCard`, and `ProductHeroSection`. The shared components default to the MongoDB source so the original catalogue route remains unchanged. The PostgreSQL route selects the PostgreSQL adapter, preserves PostgreSQL category UUIDs in its query parameters, and carries `source=postgres` into product-detail navigation so product UUIDs are resolved through `GET /api/postgres/products/:id`.

The catalogue cards and shopping-list item shape can carry Aldi pricing. Expanding every downstream shopping-list and comparison screen to display or optimise across Aldi is intentionally outside the scope of this catalogue integration and is not currently required. Existing MongoDB-backed authentication and shopping-list persistence remain unchanged; MongoDB ID checks in the shopping-list context apply to list IDs, not PostgreSQL catalogue product UUIDs.

## Tests

The source-measurement migration remains intentionally covered because every fresh database must add and backfill `source_measurement` before finalisation renames it to `pack_display_unit`. Tests also cover both catalogue query mappings, schema detection, the runtime pricing projection, and its reversible move back to the migration schema.

Run the focused backend checks from `Backend`:

```bash
npm run check:postgres-catalogue
node --test test/postgres-catalogue.config.test.js \
  test/migration-catalogue-transform.test.js \
  test/postgres-catalogue.repository.test.js \
  test/postgres-catalogue.mapper.test.js
```

With a configured local PostgreSQL database, run the live read-only integration test against whichever schema stage is currently installed:

```bash
RUN_POSTGRES_CATALOGUE_INTEGRATION=true \
  node --test test/postgres-catalogue.integration.test.js
```

Run the shared frontend contract check from `Frontend`:

```bash
npx jest services/__tests__/catalogueAdapters.test.ts --runInBand --watchAll=false
```
