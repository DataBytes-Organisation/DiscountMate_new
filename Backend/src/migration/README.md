# MongoDB to PostgreSQL migration

This module creates the App PostgreSQL (migration/finalisation) schema and repeatably copies App Dev data from MongoDB. This module prepares and backfills PostgreSQL. Controllers remain Mongo-backed. 

Implemented copy phases:

1. users, profiles, subscriptions, preferences, and receipts
2. categories and products
3. product-pricing history
4. shopping lists and comparison snapshots
5. alert segments and in-app notifications
6. support requests and optional attachments

## Architecture

```text
src/migration/
├── database/
│   ├── app-data-source.js       Migration PostgreSQL TypeORM connection and order
│   ├── finalised-data-source.js   Finalised PostgreSQL TypeORM connection and order
│   ├── entities.js              Collects migration EntitySchema metadata
│   ├── initialising_database/   One-time PostgreSQL DDL changes
│   └── persistence/             TypeORM table/property mappings by App sector
├── cli/
│   ├── lib/                      Shared transformations and audit persistence
│   ├── phases/                   Copy, outcome recording, and reconciliation
│   ├── mongo-to-postgres.js     Runs one data phase
│   ├── run-all-migrations.js    Runs every phase in dependency order
│   ├── run-all-reconciliations.js  Reconciles every phase without copying
│   └── silver-schema.js         Local Docker/Alembic Silver setup
├── shared/                           Migration-only retailer normalization
├── diagrams/                         Editable Legacy MongoDB and PostgreSQL ERDs
```

Schema ownership:

- `app`: operational App/API data owned by TypeORM;
- `silver`: canonical categories, products, retailers, and prices owned by DE
- `migration`: copy/reconciliation audit records;
- `public`: only the TypeORM and Alembic version ledgers.

### Schema references

- [Legacy MongoDB Draw.io diagram](./diagrams/legacy-mongodb-schema.drawio): editable source-database view, including collections not copied by migration.
- [Migration PostgreSQL](./MIGRATION_POSTGRESQL_SCHEMA.md): every table and field used immediately after the MongoDB copy, including why bridge/legacy values exist.
- [Finalised PostgreSQL](./FINALISED_POSTGRESQL_SCHEMA.md): every table and field after the optional cleanup, including exactly what is kept renamed, moved, or controller-derived.
- [Migration PostgreSQL Draw.io ERD](./diagrams/migration-postgresql-schema.drawio): editable migration-stage tables, PostgreSQL field types, nullability, keys, and links.
- [Finalised PostgreSQL Draw.io ERD](./diagrams/finalised-postgresql-schema.drawio): the same editable view after the optional rename/move/field cleanup.


## Run the migration

### 1. Setting up local PostgreSQL with DE PostgreSQL Database

```bash
cd DE/etl-pipeline
docker compose up -d postgres
docker compose exec -T postgres pg_isready -U postgres -d discountmate
```

If `DE/etl-pipeline/.env` does not exist, create it with `cp .env.example .env` before starting Docker. Do not overwrite existing file. Obtain URL to access docker based PostgreSQL.

Example:
```text
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/discountmate
```

Do not use `docker compose down -v` unless the database volume is intentionally being deleted. `docker compose stop postgres` is the safe normal stop command without losing data.

PostgreSQL shared memory defaults to 256 MB. Override it in `DE/etl-pipeline/.env`, then recreate only the service (if necessary):

```dotenv
POSTGRES_SHM_SIZE=512mb
```

```bash
docker compose up -d postgres
``` 

### 2. Configure Backend Env

Return to Backend folder and install dependencies: 
```bash
cd ../../Backend
npm ci
```

From `Backend`, preserve any existing `.env`. The current required values are:

```dotenv
MONGO_URI=mongodb+srv://your-existing-connection
MONGO_DB_NAME=DiscountMate_DB
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/discountmate
```

### 3. Using unified commands

# Migration Command: 

Run from `Backend`:

```bash
npm run migrate:all
```

It runs, in order:

```text
db:migrate
→ db:silver:setup
→ users/subscriptions/receipts
→ support requests/attachments
→ categories/products
→ product pricing
→ shopping lists/comparisons
→ alerts/notifications
```
# Reconcile Command

From Backend: 

```bash
npm run reconcile:all
```

The command continues through reconciliation mismatches, so every phase runs. It exits `1` if any phase has a technical failure, `2` when the only failures are mismatches, and `0` when every phase passes.

### 4. Running Commands in Individual Phases

From Backend.
Run only one copy or reconciliation when investigating specific 'phases' (i.e tables saved in database):

```bash
npm run migrate:users
npm run reconcile:users

npm run migrate:catalog
npm run reconcile:catalog

npm run migrate:product-pricing
npm run reconcile:product-pricing

npm run migrate:shopping-lists
npm run reconcile:shopping-lists

npm run migrate:alerts-notifications
npm run reconcile:alerts-notifications

npm run migrate:support-requests
npm run reconcile:support-requests
```

Schema status commands:

```bash
npm run db:migrate:show
npm run db:silver:status
npm run db:finalised:preview
```

`db:finalised:preview` is read-only. It projects Migration PostgreSQL as the proposed clean contract, excludes migration-only fields such as `legacy_*` and `raw_payload`, and reports unresolved PostgreSQL references. Pricing snapshots whose source list is unavailable remain valid historical records; their
`legacy_shopping_list_id` is projected as the durable `snapshot_list_key`. The preview never drops a column or changes Migration PostgreSQL. Use it before the later controller cutover/cleanup migration.

### Apply or revert Finalised PostgreSQL

This optional TypeORM track is separate from normal migrations:

```bash
npm run db:finalised:preview
npm run db:finalised:apply

# Return to Migration PostgreSQL if needed
npm run db:finalised:revert
```

`db:finalised:apply` removes the migration-only columns, renames migration-stage tables to proposed names, renames `legacy_shopping_list_id` to `snapshot_list_key`, and moves source-lineage tables from `app` to `migration`. Every removed field value is copied to the restricted `migration.finalised_schema_field_backup` table.
Revert restores the original columns, table names, constraints, and saved values.

Finalised PostgreSQL refuses to apply while a required reference failure or active data migration remains. A missing shopping-list relationship is optional and does not block finalisation. Do not run Mongo copy phases or the current migration-stage repositories while it is applied; revert first. Back up PostgreSQL before applying it outside local development, and do not manually delete the finalisation backup table.

## Maintenance and safety

- Schema change: add a new timestamped TypeORM migration, register it in `app-data-source.js`, update the relevant persistence entity, and add its syntax check to `Backend/package.json`.
- Mongo field-mapping change: update `cli/lib/*-transform.js`, and the phase SQL only when destination changes.
- New copy phase: add a transformer and phase, register it in CLI options, `mongo-to-postgres.js`, npm scripts, and `run-all-migrations.js` in dependency order.
- Silver schema changes belong to DE Alembic, 
- App changes during Migration PostgreSQL belong to TypeORM.

Copy phases are idempotent and do not delete MongoDB documents. Each Mongo aggregate is written in a PostgreSQL transaction, IDs remain stable through `migration.entity_id_map`, and every normal run performs reconciliation. Stop and investigate unresolved failures before cutover.

Validation, normalization, identity, and technical details are stored separately in `migration.record_issues`. Missing UUID/FK lookups are stored in `migration.reference_resolution_issues`; required unresolved references block the document, while optional references allow migration with a warning. A later run may mark a reference issue resolved without rewriting the historical outcome.

### Outcome policy by phase

Every scanned source document receives exactly one terminal row in `migration.record_outcomes`: `migrated`, `rejected`, `blocked`, or `failed`. `rejected` means the source document itself does not satisfy a declared migration policy. `blocked` means the source is acceptable but cannot be written safely until identity or required dependency is resolved. `failed` is reserved for an unexpected database, infrastructure, or programming error.

| Phase | Migrated, possibly with warnings | Rejected source policy | Blocked dependency or identity |
| --- | --- | --- | --- |
| Users, subscriptions, receipts | Required user identity and bcrypt hash are valid; optional postcode, profile image, metrics, receipt values, retailer links, and preserved active subscriptions may warn. | Missing Mongo ID/email, or missing/invalid bcrypt hash. | Email maps to conflicting users, or the normalized email is already owned by another user. |
| Categories and products | Required catalogue fields are valid; invalid optional display order, GTIN, pack unit, or pack quantity is omitted with a warning. | Category missing ID/name; product missing ID/category reference/name/code. | Category/product identity is ambiguous, or the product's required category was not migrated. |
| Product pricing | Product, retailer, timestamp, and price are valid; a zero price is preserved in pricing history and current/last snapshots with `product_pricing_zero_price`, while invalid optional best/unit prices are omitted with warnings. | Missing/invalid required fields, unsupported retailer, or any price below zero (`product_pricing_negative_price`). | Required product/retailer was not migrated, or product identity is ambiguous. |
| Shopping lists and pricing snapshots | Required owner/data fields are valid; malformed optional amounts/items/references warn. A snapshot whose shopping list is unavailable is preserved with its legacy list key and an optional-reference warning. | List missing ID/owner; snapshot missing ID/list reference/owner. | Required user is unavailable, resolved owner identities conflict, or another required identity constraint conflicts. |
| Alert segments and notifications | Required owner/alert fields are valid; optional category/product references and defaulted optional notification text warn. | Missing ID/owner, or an alert missing its category key. | Required user is unavailable, owners conflict, or a unique alert/deal identity conflicts. |
| Support requests | Required request fields and statuses are valid; an invalid optional attachment is omitted with its specific warning reason. | Missing ID/reference/name/email/topic/message/support email, or invalid request/email status. | The reference number belongs to a different source request. |

For every phase, a successfully committed target write is `migrated`; a caught unexpected write error is `failed`. The ledger reconciliation enforces `source_count = migrated + rejected + blocked + failed` for normal copy runs.

Exit codes:

- `0`: copy and reconciliation passed, including recognized rejections or warnings;
- `1`: an unexpected command, setup, database, or programming failure occurred;
- `2`: required dependencies remain blocked or reconciliation mismatches remain.

Useful read-only checks:

```bash
docker exec discount_mate_etl_postgres psql -U postgres -d discountmate -c '\dn'
docker exec discount_mate_etl_postgres psql -U postgres -d discountmate -c 'SELECT status, phase, source_count, migrated_count, rejected_count, blocked_count, failed_count, warning_count FROM migration.runs ORDER BY started_at DESC;'
docker exec discount_mate_etl_postgres psql -U postgres -d discountmate -c 'SELECT outcome, primary_reason_code, count(*) FROM migration.record_outcomes GROUP BY outcome, primary_reason_code ORDER BY outcome, count(*) DESC;'
docker exec discount_mate_etl_postgres psql -U postgres -d discountmate -c 'SELECT target_schema, target_table, source_field, reason_code, required, count(*) FROM migration.reference_resolution_issues WHERE resolved_at IS NULL GROUP BY target_schema, target_table, source_field, reason_code, required ORDER BY required DESC, count(*) DESC;'
```
