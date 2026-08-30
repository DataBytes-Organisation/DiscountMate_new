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
│   ├── lib/                      Field normalization; no database writes
│   ├── phases/                   Copy, quarantine, and reconciliation
│   ├── mongo-to-postgres.js     Runs one data phase
│   ├── run-all-migrations.js    Runs every phase in dependency order
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

PostgreSQL shared memory defaults to 256 MB. Override it in `DE/etl-pipeline/.env`, then recreate only the service:

```dotenv
POSTGRES_SHM_SIZE=512mb
```

```bash
docker compose up -d postgres
``` 

### 2. Configure Backend Env

From `Backend`, preserve any existing `.env`. The current required values are:

```dotenv
MONGO_URI=mongodb+srv://your-existing-connection
MONGO_DB_NAME=DiscountMate_DB
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/discountmate
PGSSLMODE=disable
```

Install dependencies with `npm ci`.

### 3. Use the unified command

Back up MongoDB and PostgreSQL first, then run from `Backend`:

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

The runner stops on the first failed schema step, copy, or reconciliation. Its normal terminal output contains only step progress and the processed, written, skipped, failed, and reconciliation-check counts. Full JSON console dumps and generated Markdown reports are not produced.

### Run or inspect individual phases

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

`db:finalised:preview` is read-only. It projects Migration PostgreSQL as the proposed
clean contract, excludes migration-only fields such as `legacy_*` and
`raw_payload`, and reports unresolved PostgreSQL references. Pricing snapshots
whose source list is unavailable remain valid historical records; their
`legacy_shopping_list_id` is projected as the durable `snapshot_list_key`. The
preview never drops a column or changes Migration PostgreSQL. Use it before the
later controller cutover/cleanup migration.

### Apply or revert Finalised PostgreSQL

This optional TypeORM track is separate from normal migrations:

```bash
npm run db:finalised:preview
npm run db:finalised:apply

# Return to Migration PostgreSQL if needed
npm run db:finalised:revert
```

`db:finalised:apply` removes the migration-only columns, renames migration-stage tables to
proposed names, renames `legacy_shopping_list_id` to `snapshot_list_key`, and
moves source-lineage tables from `app` to `migration`. Every removed field value
is copied to the restricted `migration.finalised_schema_field_backup` table.
Revert restores the original columns, table names, constraints, and saved values.

Finalised PostgreSQL refuses to apply while a required reference failure or
active data migration remains. A missing shopping-list relationship is optional
and does not block finalisation. Do not run Mongo copy phases or the current
migration-stage repositories while it is applied; revert first. Back up PostgreSQL
before applying it outside local development, and do not manually delete the
finalisation backup table.

## Maintenance and safety

- Schema change: add a new timestamped TypeORM migration, register it in
  `app-data-source.js`, update the relevant persistence entity, and add its syntax
  check to `Backend/package.json`.
- Mongo field-mapping change: update `cli/lib/*-transform.js`, and the
  phase SQL only when destination changes.
- New copy phase: add a transformer and phase, register it in CLI options,
  `mongo-to-postgres.js`, npm scripts, and `run-all-migrations.js` in dependency order.
- Silver schema changes belong to DE Alembic, 
- App changes during Migration PostgreSQL belong to TypeORM.

Copy phases are idempotent and do not delete MongoDB documents. Each Mongo
aggregate is written in a PostgreSQL transaction, IDs remain stable through
`migration.entity_id_map`, and every normal run performs reconciliation. Stop and
investigate unresolved failures before cutover.

Failed UUID/FK lookups are also written to
`migration.reference_resolution_failures`. Each row identifies the source field,
source value, intended PostgreSQL table, reason, and whether the reference was
required. A later successful migration run marks resolvable warnings with
`resolved_at` instead of deleting their audit history.

Exit codes:

- `0`: copy and reconciliation passed;
- `1`: command/setup failure;
- `2`: copy finished but failures or reconciliation mismatches remain.

Useful read-only checks:

```bash
docker exec discount_mate_etl_postgres psql -U postgres -d discountmate -c '\dn'
docker exec discount_mate_etl_postgres psql -U postgres -d discountmate -c 'SELECT status, phase, source_count, target_count, skipped_count, failed_count FROM migration.runs ORDER BY started_at DESC;'
docker exec discount_mate_etl_postgres psql -U postgres -d discountmate -c 'SELECT reason, count(*) FROM migration.unmapped_documents WHERE resolved_at IS NULL GROUP BY reason;'
docker exec discount_mate_etl_postgres psql -U postgres -d discountmate -c 'SELECT target_schema, target_table, source_field, reason, required, count(*) FROM migration.reference_resolution_failures WHERE resolved_at IS NULL GROUP BY target_schema, target_table, source_field, reason, required ORDER BY required DESC, count(*) DESC;'
```
