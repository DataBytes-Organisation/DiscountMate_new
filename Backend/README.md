# DiscountMate backend

From the repository root, first start the local PostgreSQL container:

```bash
cd DE/etl-pipeline
docker compose up -d
cd ../..
```

Then prepare the separate App database, run its migrations, and start the
watched backend server:

```bash
cd Backend
npm install
npm run migrate:app
npm run dev
```

`npm run migrate:app` now creates the database named by a local
`APP_DATABASE_URL` when it does not exist, then applies the App migrations. It
refuses to create a remote database unless `ALLOW_APP_DATABASE_CREATE=true` is
set explicitly; deployed databases should normally be provisioned by
infrastructure instead.

The comparison module uses two connection strings from `Backend/.env`:

- `DE_DATABASE_URL`: read-only Silver catalogue, offers, history, and grouping.
- `APP_DATABASE_URL`: comparison snapshots, mappings, events, and shopping sessions.

For local Docker development both URLs may point at different databases/roles on
the same PostgreSQL instance, but the application still opens separate pools.
`COMPARISON_V2_ENABLED=true` is required in production; development enables the
module by default.

## Saved-list identity during migration

Saved lists are still owned by MongoDB until Feature 3 completes its App
PostgreSQL cutover. Comparison never joins MongoDB directly to Silver by name.
Instead it resolves each stable Mongo product reference through:

1. `app.comparison_product_mappings`, when a deterministic mapping was already saved;
2. an existing Silver comparison-group UUID stored on a newer list item;
3. one unique GTIN match;
4. one strict compatible brand, normalized-name, category, and pack match.

Ambiguous and unmatched lines remain in the list and are reported to the UI with
their reason. Deterministic mappings are written only to App PostgreSQL; the
Silver catalogue is never copied to MongoDB. New list items retain GTIN, brand,
pack, image, and comparison identity metadata so they do not depend on fuzzy
matching later.
