# Comparison V2 production rollout

This runbook enables product search and grocery-list comparison against the
existing production PostgreSQL database.

## Approved temporary semester setup

To meet the current project deadline, both Comparison database connections use
the existing `discount_mate_app` PostgreSQL user and the existing
`discount_mate` database. One GitHub Actions secret supplies the same URL to
both `DE_DATABASE_URL` and `APP_DATABASE_URL`.

This is intentionally temporary. `discount_mate_app` has broad database access.
Next semester, replace it with separate least-privilege reader and writer roles
and separate Secret Manager secrets.

The old repository variables `DE_DATABASE_URL_SECRET_NAME` and
`APP_DATABASE_URL_SECRET_NAME` are not used by this rollout and can remain until
the least-privilege follow-up is implemented. No new GCP Secret Manager secret
or Secret Manager IAM permission is required for this temporary setup.

## Confirmed production values

| Setting | Value |
|---|---|
| GCP project | `sit-26t1-discountmate-935cb94` |
| Region | `australia-southeast1` |
| Cloud SQL instance | `discount-mate-prod-postgres` |
| Connection name | `sit-26t1-discountmate-935cb94:australia-southeast1:discount-mate-prod-postgres` |
| PostgreSQL database | `discount_mate` |
| Temporary database user | `discount_mate_app` |
| Current DE migration | `20260510_0003` |
| Target DE migration | `20260828_0011` |
| Backend service | `webdev-backend` |
| GitHub secret | `COMPARISON_DATABASE_URL` |

## Safety rules

- Keep `BACKEND_COMPARISON_V2_ENABLED=false` and
  `FRONTEND_COMPARISON_V2_ENABLED=false` until the migrations and tests pass.
- Create and verify a Cloud SQL backup before changing the schema.
- Run migrations as `discount_mate_app`, never as `postgres`.
- Never paste the database password into an issue, PR, commit, screenshot, or
  terminal command history.
- Do not use `alembic stamp` to bypass migration errors.
- Existing public-network and SSL settings are a separate security follow-up;
  do not change them during this time-sensitive rollout.

## Phase 1: merge and deploy with Comparison disabled

1. Merge the Comparison rollout PR into `main`.
2. Confirm these GitHub repository variables remain `false`:

   - `BACKEND_COMPARISON_V2_ENABLED`
   - `FRONTEND_COMPARISON_V2_ENABLED`

3. Run **App Dev Cloud Run Prep** from GitHub Actions, or allow the merge to
   trigger it.
4. Confirm the deployment succeeds. The production comparison page should
   still say Comparison is unavailable; that is expected at this stage.

## Phase 2: create and verify a backup

Run these commands in a terminal authenticated to the production project:

```bash
DM_PROJECT_ID="sit-26t1-discountmate-935cb94"
DM_SQL_INSTANCE="discount-mate-prod-postgres"
DM_SQL_CONNECTION_NAME="sit-26t1-discountmate-935cb94:australia-southeast1:discount-mate-prod-postgres"

gcloud config set project "$DM_PROJECT_ID"
gcloud sql backups create \
  --instance="$DM_SQL_INSTANCE" \
  --description="Before Comparison V2 migrations"
gcloud sql backups list --instance="$DM_SQL_INSTANCE" --limit=5
```

Do not proceed until the new backup status is `SUCCESSFUL`. Save its backup ID
in the deployment notes.

## Phase 3: start Cloud SQL Auth Proxy

On Apple Silicon macOS, run this in terminal 1:

```bash
curl -o /tmp/cloud-sql-proxy \
  https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.25.4/cloud-sql-proxy.darwin.arm64
chmod +x /tmp/cloud-sql-proxy
gcloud auth application-default login
/tmp/cloud-sql-proxy --port 5434 "$DM_SQL_CONNECTION_NAME"
```

For an Intel Mac, replace `darwin.arm64` with `darwin.amd64`. Leave terminal 1
open. Continue only after the proxy says it is ready for new connections.

## Phase 4: apply the DE migrations

Open terminal 2 at the repository root after pulling the merged `main`. Enter
the existing `discount_mate_app` password when prompted; it will not display.

```bash
cd DE/etl-pipeline

export POSTGRES_HOST="127.0.0.1"
export POSTGRES_PORT="5434"
export POSTGRES_DATABASE="discount_mate"
export POSTGRES_USER="discount_mate_app"
read -s POSTGRES_PASSWORD
export POSTGRES_PASSWORD

uv sync --frozen
uv run alembic current
uv run alembic upgrade head
uv run alembic current
```

The first `current` should report `20260510_0003`. The final `current` must
report `20260828_0011`. The runtime-access migration will retain the approved
shared-user setup when the optional `comparison_reader` role is absent.

Stop if any migration fails. Do not continue to the App migrations or enable a
feature flag.

## Phase 5: apply the App migrations

In terminal 2, move to the backend and construct a local proxy URL. URL encoding
the password prevents characters such as `@`, `#`, or `/` from breaking it.

```bash
cd ../../Backend
npm ci

read -s DM_DATABASE_PASSWORD
DM_DATABASE_PASSWORD_ENCODED="$(node -p 'encodeURIComponent(process.argv[1])' "$DM_DATABASE_PASSWORD")"
export APP_DATABASE_URL="postgresql://discount_mate_app:${DM_DATABASE_PASSWORD_ENCODED}@127.0.0.1:5434/discount_mate"

npm run migrate:app
npm run migrate:app
```

The first run should apply the comparison migrations. The second run should
report that no migrations are pending.

## Phase 6: run the database integration test

Use the same approved URL for the DE connection, then run the integration test:

```bash
export DE_DATABASE_URL="$APP_DATABASE_URL"
export RUN_COMPARISON_POSTGRES_INTEGRATION="true"
node --test test/comparison.postgres.integration.test.js
```

Both integration tests must pass. They verify that the Silver comparison views
can be read and that App comparison snapshots can be written correctly.

In Cloud SQL Studio, connected to `discount_mate` as `discount_mate_app`, run:

```sql
SELECT
  to_regclass('silver.comparison_products') AS products,
  to_regclass('silver.comparison_latest_offers') AS offers,
  to_regclass('silver.comparison_price_history') AS history,
  to_regclass('silver.comparison_product_groups') AS groups,
  to_regclass('app.comparison_runs') AS app_runs,
  to_regclass('app.comparison_plans') AS app_plans;

SELECT
  (SELECT count(*) FROM silver.comparison_products) AS products,
  (SELECT count(*) FROM silver.comparison_latest_offers) AS offers;
```

All six relation names must be non-null. Product search also needs product and
offer data; if either count is zero, keep the flags disabled and run or repair
the data pipeline before continuing.

## Phase 7: verify the GitHub secret

In GitHub, open **Settings → Secrets and variables → Actions → Secrets**. The
repository secret must be named exactly:

```text
COMPARISON_DATABASE_URL
```

Its value must use the Cloud Run Unix socket form below. Replace only the
placeholder with the URL-encoded `discount_mate_app` password:

```text
postgresql://discount_mate_app:URL_ENCODED_PASSWORD@/discount_mate?host=/cloudsql/sit-26t1-discountmate-935cb94:australia-southeast1:discount-mate-prod-postgres
```

Do not add quotes around the secret value. Do not show its value in logs or
screenshots. The workflow injects this one secret into both runtime connection
variables.

## Phase 8: enable and verify the backend first

1. Change only `BACKEND_COMPARISON_V2_ENABLED` to `true`.
2. Leave `FRONTEND_COMPARISON_V2_ENABLED=false`.
3. Run **App Dev Cloud Run Prep**.
4. Confirm the backend deployment and its built-in comparison search smoke test
   pass.
5. If needed, verify the public endpoint without printing credentials:

```bash
curl --fail --silent --show-error \
  "https://discountmate.app/api/v2/comparison/products/search?q=apple&limit=5"
```

If the workflow or endpoint fails, set the backend flag back to `false`, deploy
again, and inspect the backend logs before proceeding.

## Phase 9: enable and verify the frontend

1. Change `FRONTEND_COMPARISON_V2_ENABLED` to `true`.
2. Run **App Dev Cloud Run Prep** again.
3. Open `https://discountmate.app/compare` in a private browser window.
4. Search for a product that exists in the Silver product count.
5. Test the Grocery List tab with at least one saved item.

Expected result: search returns products and grocery-list comparison no longer
shows `Comparison V2 is disabled`.

## Common failures

- **`Comparison V2 is disabled`**: the relevant feature flag is still false or
  the service has not been redeployed since it changed.
- **Missing `COMPARISON_DATABASE_URL`**: create the GitHub Actions repository
  secret with the exact name in Phase 7.
- **Cloud SQL connection error**: confirm the connection-name repository
  variable and that the Cloud Run service account has Cloud SQL Client.
- **Relation does not exist**: a migration did not reach its required head.
- **Search returns no products**: the Silver relations exist but the data
  pipeline has not populated products and current offers.
- **Password authentication or URL parsing error**: confirm the password is
  correct and URL encoded; never post it for troubleshooting.

## Rollback

The safest first rollback is configuration-only:

1. Set both feature flags to `false`.
2. Redeploy.
3. Leave the new schemas in place while diagnosing the issue.

Do not downgrade or delete production tables merely to hide the feature. Restore
the pre-migration backup only for a confirmed database incident and coordinate
that restoration with the project owner.

## Required next-semester hardening

- Create separate `comparison_reader` and `comparison_app` PostgreSQL roles.
- Restrict the reader to the required Silver views and the writer to the App
  comparison schema.
- Store their separate URLs in Secret Manager and grant only secret-accessor to
  the runtime service account.
- Replace the temporary `COMPARISON_DATABASE_URL` workflow mapping.
- Remove the broad shared-user exception from migration `20260828_0011`.
- Review public-network access, enforce encrypted database connections, enable
  automated backups/PITR, and enable deletion protection.
