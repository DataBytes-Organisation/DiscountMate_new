# AD-03: MongoDB → PostgreSQL Cutover & Rollback Procedures

> **Status: Draft — pending validation**
> This document outlines the planned cutover and rollback sequence for the AD-03 migration.
> Migration and reconciliation scripts (AD-BE-T2) are not yet present in `main` at time of writing.
> Steps below reflect the target `discount-mate-infra/modules/postgresql` schema and DE-agreed
> architecture. This doc should be revisited and validated once AD-BE-T2 scripts are merged.

## Context

AD-03 migrates the App Dev database from MongoDB to PostgreSQL to move to a relational
structure that's easier to manage, query, and support going forward. This document defines
how the team will cut over from MongoDB to PostgreSQL, and how to roll back if issues are
found post-cutover.

## Scope

- Cutover sequence from MongoDB to PostgreSQL for the App Dev database
- Rollback triggers and steps if cutover fails or issues are found after switching
- Known limitations of the migration approach as currently understood

**Out of scope:** execution of the cutover itself, and building new migration tooling.

## Architectural Constraint

Per DE-09 (Ben Van), App Dev must read from **Gold Layer views**, not query DE's Silver
tables directly. This applies to any PostgreSQL data App Dev consumes that originates from
DE pipelines — retailer/product reference data should come through Gold views, not direct
Silver table access.

## Cutover Sequence (Planned)

1. **Freeze writes** — Put the app into maintenance mode or disable write endpoints that
   touch MongoDB collections being migrated (users, products, baskets, lists, etc.).
2. **Run final migration** — Execute the AD-BE-T2 migration script(s) _(script name/path TBD
   — pending merge)_ to perform the final full sync of MongoDB data into PostgreSQL.
3. **Run reconciliation** — Execute the reconciliation script _(TBD)_ to validate row counts
   and key records match between MongoDB and PostgreSQL.
4. **Switch application config** — Update backend `.env` / config to point database
   connections from `MONGO_URI` to the PostgreSQL connection string.
5. **Smoke test core flows** — Manually verify: login/auth, product browsing, basket
   operations, list operations against PostgreSQL.
6. **Resume writes** — Take the app out of maintenance mode once smoke tests pass.
7. **Monitor** — Watch error logs and key metrics for a defined window (e.g. 24–48 hours)
   before considering MongoDB fully deprecated.

## Rollback Triggers

Roll back if any of the following occur post-cutover:

- Core user flows (auth, product browsing, basket/list operations) fail validation
- Data reconciliation reveals critical record loss or corruption
- Unrecoverable errors in production within the monitoring window

## Rollback Steps (Planned)

1. Revert application config to point back to `MONGO_URI` (MongoDB).
2. Redeploy/restart backend service with reverted config.
3. Reconcile any data written to PostgreSQL during the cutover window back into MongoDB,
   if such writes occurred and are business-critical _(process TBD — depends on final
   migration script design)_.
4. Confirm core flows pass smoke tests against MongoDB again.
5. Communicate rollback status to the team and document root cause before re-attempting
   cutover.

## Known Limitations / Open Items

- **Migration and reconciliation scripts (AD-BE-T2) are not yet present in `main`.** This
  doc will need updating with real script names/paths once available.
- Full PostgreSQL schema beyond `dim_retailers` has not been confirmed as fully documented
  or implemented — needs verification against all App Dev collections before cutover.
- Handling of writes made _during_ the cutover window is not yet defined and depends on
  final migration script design.
- No dedicated rollback tooling currently exists; the rollback steps above are manual.

## Edge Cases to Consider

- Partial migration failure mid-cutover (some tables migrated, others not)
- Data written to MongoDB during the cutover freeze window (race condition)
- Rollback needed after some but not all core flows have been validated on PostgreSQL

## Dependencies

- AD-BE-T2 migration and reconciliation scripts (not yet merged)
- PostgreSQL environment/instance (`discount-mate-infra/modules/postgresql`)
- DE-09 Gold Layer view boundary confirmation for any DE-sourced data
