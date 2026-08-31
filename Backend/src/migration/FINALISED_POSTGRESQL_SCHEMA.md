# Finalised PostgreSQL

This is the optional clean schema produced by `npm run db:finalised:apply`. 

The Finalised Schema does **not** remove any application critical data. Users, subscriptions, receipt history, lists, alerts, and notifications all remain. It removes old source identifiers/payloads, gives four application tables clearer names, and moves two source-audit tables out of `app`.

## What changed from Migration PostgreSQL

| Action | Migration PostgreSQL object | Finalised PostgreSQL object |
| --- | --- | --- |
| Rename | `app.user_legacy_metrics` | `app.user_metrics` |
| Rename | `app.notification_product_references` | `app.notification_products` |
| Rename | `app.category_api_compatibility` | `app.category_metadata` |
| Rename | `app.product_api_compatibility` | `app.product_metadata` |
| Move | `app.catalog_source_keys` | `migration.catalog_source_keys` |
| Move | `app.product_price_source_records` | `migration.product_price_source_records` |
| Remove fields | `legacy_*`, selected source `*_key`, and `raw_payload` fields | Values are first saved in `migration.finalised_schema_field_backup` |

No required App table is deleted. A renamed table still contains the same rows; a moved table still contains the same rows but has a more accurate owner.

## The four schemas

| Schema | What it contains in Finalised PostgreSQL |
| --- | --- |
| `app` | Runtime data and App-owned catalogue metadata used by controllers. |
| `silver` | Canonical categories, products, retailers, and price facts. |
| `migration` | Copy history, aliases, source lineage, failures, reconciliation, and the reversible field backup. |
| `public` | TypeORM and Alembic version ledgers only. |

`FK` means a physical PostgreSQL foreign key. App-to-Silver references described as `logical FK` are reconciled UUIDs rather than physical constraints so DE can manage Silver independently. Every field below includes its PostgreSQL type; `?` after the type means nullable.

## Finalised PostgreSQL App tables

### Users and subscriptions

| Table | What it does | Finalised PostgreSQL fields |
| --- | --- | --- |
| `app.users` | Login identity, authorization role, verification, and account status. | `id uuid PK`; `email citext unique`; `password_hash text`; `role text`; `status text`; `email_verified_at timestamptz?`; `phone_verified_at timestamptz?`; `password_changed_at timestamptz?`; `created_at timestamptz`; `updated_at timestamptz` |
| `app.user_profiles` | Optional personal information separate from login credentials. | `user_id uuid PK/FK`; `first_name varchar(100)?`; `last_name varchar(100)?`; `phone_number varchar(32)?`; `address text?`; `postcode char(4)?`; `date_of_birth date?`; `bio text?`; `created_at timestamptz`; `updated_at timestamptz` |
| `app.user_profile_images` | A user's binary profile picture. | `user_id uuid PK/FK`; `mime_type varchar(100)`; `image_data bytea`; `created_at timestamptz`; `updated_at timestamptz` |
| `app.user_notification_preferences` | Per-user notification switches. | `user_id uuid PK/FK`; `price_alerts_enabled boolean`; `weekly_summary_enabled boolean`; `browser_notifications_enabled boolean`; `updated_at timestamptz` |
| `app.user_dashboard_preferences` | Canonical list and retailer selected on the dashboard. | `user_id uuid PK/FK`; `selected_list_id uuid? FK`; `selected_retailer_id uuid? logical FK`; `created_at timestamptz`; `updated_at timestamptz` |
| `app.user_metrics` | Savings, trip, and list counters displayed for a user. This is the renamed `user_legacy_metrics` table, not a replacement table. | `user_id uuid PK/FK`; `total_saved numeric(12,2)`; `shopping_trips integer`; `shopping_lists_count integer`; `updated_at timestamptz` |
| `app.subscription_plans` | Available plan catalogue, prices, and optional limits. | `code text PK`; `display_name text`; `price_cents integer`; `currency char(3)`; `billing_interval text`; `price_suffix text`; `badge text?`; `max_active_alerts integer?`; `max_saved_lists integer?`; `is_active boolean`; `display_order integer`; `created_at timestamptz`; `updated_at timestamptz` |
| `app.subscription_plan_features` | Ordered feature/marketing lines displayed for each plan. | `id uuid PK`; `plan_code text FK`; `display_text text`; `display_order integer` |
| `app.user_subscriptions` | A user's current and historical subscriptions, including provider references when applicable. | `id uuid PK`; `user_id uuid FK`; `plan_code text FK`; `status text`; `source text`; `provider_customer_id text?`; `provider_subscription_id text?`; `started_at timestamptz`; `current_period_start timestamptz?`; `current_period_end timestamptz?`; `cancelled_at timestamptz?`; `ended_at timestamptz?`; `created_at timestamptz`; `updated_at timestamptz` |

The plan rows currently use `free`, `premium`, and `family`. Subscription status is `active`, `cancelled`, or `ended`. The seeded Free plan has a five-alert value, but enforcing that limit remains service/controller behaviour; a database row does not enforce it by itself.

### Receipts

| Table | What it does | Finalised PostgreSQL fields |
| --- | --- | --- |
| `app.receipts` | Receipt header/history owned by a user. `retailer_id` is a logical FK to the canonical retailer; `store_name` preserves the name printed at the time. | `id uuid PK`; `user_id uuid FK`; `retailer_id uuid? logical FK`; `store_name text`; `receipt_number text?`; `purchased_at timestamptz?`; `uploaded_at timestamptz`; `subtotal numeric(12,2)?`; `total numeric(12,2)?`; `savings numeric(12,2)?`; `source text`; `created_at timestamptz`; `updated_at timestamptz` |
| `app.receipt_items` | Ordered line items belonging to a receipt. | `id uuid PK`; `receipt_id uuid FK`; `line_number integer`; `item_name text?`; `quantity numeric(12,3)`; `unit_price numeric(12,2)?`; `line_total numeric(12,2)?`; `matched_product_id uuid? logical FK`; `created_at timestamptz` |

Receipt history therefore still exists. Only `source_receipt_key` and the two `raw_payload` source copies are removed from the runtime tables.

### Shopping lists and pricing history

| Table | What it does | Finalised PostgreSQL fields |
| --- | --- | --- |
| `app.shopping_lists` | Saved shopping-list headers owned by users. | `id uuid PK`; `user_id uuid FK`; `name text`; `description text`; `accent text`; `is_active boolean`; `total numeric(12,2)`; `savings numeric(12,2)`; `created_at timestamptz`; `updated_at timestamptz` |
| `app.shopping_list_items` | Ordered list lines. UUIDs link current canonical records; names and prices are intentional display/history snapshots. | `id uuid PK`; `shopping_list_id uuid FK`; `line_number integer`; `product_id uuid? logical FK`; `product_name text`; `quantity integer`; `unit_price numeric(12,2)`; `retailer_id uuid? logical FK`; `image_url text?`; `category_id uuid? logical FK`; `category_name text?`; `retailer_prices jsonb`; `created_at timestamptz` |
| `app.list_pricing_snapshots` | Historical result of comparing a whole list across retailers. `shopping_list_id` is nullable so history survives list deletion; `snapshot_list_key` remains available for grouping standalone history. | `id uuid PK`; `user_id uuid FK`; `shopping_list_id uuid? FK`; `snapshot_list_key text`; `list_name text`; `selected_retailer_id uuid? logical FK`; `retailer_totals jsonb`; `comparison_status text`; `comparable_retailer_count integer`; `available_retailers text[]`; `cheapest_retailer_id uuid? logical FK`; `cheapest_total numeric(12,2)`; `highest_retailer_id uuid? logical FK`; `highest_total numeric(12,2)`; `selected_total numeric(12,2)`; `total_saved numeric(12,2)`; `savings_rate numeric(7,2)`; `comparison_label text`; `item_count integer`; `source text`; `created_at timestamptz`; `updated_at timestamptz` |

`retailer_prices` and `retailer_totals` remain JSON because they record one calculation/snapshot across a variable set of retailers. They are not MongoDB documents masquerading as canonical product rows. `comparison_status` is `comparable`, `single_retailer`, `no_pricing`, or `unpriceable`.

### Alerts and notifications

| Table | What it does | Finalised PostgreSQL fields |
| --- | --- | --- |
| `app.alert_segments` | A user's alert selection and state for one category. | `id uuid PK`; `user_id uuid FK`; `category_id uuid? logical FK`; `category_key text`; `category_label text`; `active boolean`; `created_at timestamptz`; `updated_at timestamptz` |
| `app.notifications` | In-app notification content, routing metadata, and read state. | `id uuid PK`; `user_id uuid FK`; `type text`; `title text`; `message text`; `is_read boolean`; `category_id uuid? logical FK`; `category_key text?`; `category_label text?`; `cta_route text?`; `deal_key text?`; `source_types text[]`; `created_at timestamptz`; `updated_at timestamptz` |
| `app.notification_products` | Ordered many-to-many bridge between a notification and the canonical products it references. | `id uuid PK`; `notification_id uuid FK`; `line_number integer`; `product_id uuid? logical FK` |

`notification_products` should not be removed: a notification can reference several products, and a product can appear in several notifications. Only
unresolved Mongo product alias is removed.

### Support requests

| Table | What it does | Finalised PostgreSQL fields |
| --- | --- | --- |
| `app.support_requests` | Final PostgreSQL contact/support header prepared by migration; it becomes the active store only after an explicit controller cutover. `user_id` remains nullable because current and historical contact submissions are unauthenticated. | `id uuid PK`; `reference_number text unique`; `user_id uuid? FK`; `name text`; `email citext`; `topic text`; `subject text?`; `message text`; `support_email citext`; `email_status text`; `status text`; `created_at timestamptz`; `updated_at timestamptz` |
| `app.support_request_attachments` | Optional one-to-one attachment, separated from the request header. | `id uuid PK`; `support_request_id uuid FK unique`; `original_name text`; `mime_type text`; `size_bytes integer`; `data bytea`; `created_at timestamptz` |

These tables are identical in Migration PostgreSQL and Finalised PostgreSQL; they contain operational App data rather than Mongo compatibility fields.

### App-owned catalogue metadata

| Table | What it does | Finalised PostgreSQL fields |
| --- | --- | --- |
| `app.category_metadata` | App/API fields that do not belong to the fixed DE category dimension. Its `category_id` is the same UUID as `silver.dim_categories.id`. | `category_id uuid PK/logical FK`; `description text?`; `icon_url text?`; `display_order integer?`; `is_active boolean`; `updated_at timestamptz` |
| `app.product_metadata` | App/API fields that do not belong to the fixed DE product dimension. Its `product_id` is the same UUID as `silver.dim_products.id`. | `product_id uuid PK/logical FK`; `description text?`; `image_link_primary text?`; `updated_at timestamptz` |

These two metadata tables are **not duplicate category/product tables**. Silver owns the canonical catalogue fields; App owns only extra presentation/API fields. They are joined through their shared UUID.

`app.product_metadata.image_link_primary` must remain until DE and App agree on image ownership. If Silver becomes the complete image source of truth, DE must publish an explicit primary/front/preferred image (ideally through a normalized product-image table with image role and ordering), after which App metadata may hold only an optional UI override/reference. If DE owns source images but not the App's display choice, `image_link_primary` remains intentional App-owned metadata. Do not remove it merely because Silver currently has `image_link_side` and `image_link_back`, neither column reliably identifies the primary image.

## Silver tables

The optional finalisation does not alter Silver.

| Table | What it does | Fields |
| --- | --- | --- |
| `silver.dim_categories` | Canonical category dimension. | `id uuid PK`; `category_name text unique`; `created_at timestamptz`; `updated_at timestamptz` |
| `silver.dim_products` | Canonical product/SKU dimension and current/last retailer values exposed by the DE shape. | `id uuid PK`; `category_id uuid FK`; `product_name text`; `brand_name text?`; `gtin varchar(14)? unique`; `pack_quantity numeric(10,3)?`; `pack_uom text?`; `price_current_coles numeric(10,2)?`; `price_last_coles numeric(10,2)?`; `price_current_woolworths numeric(10,2)?`; `price_last_woolworths numeric(10,2)?`; `price_current_aldi numeric(10,2)?`; `price_last_aldi numeric(10,2)?`; `price_current_iga numeric(10,2)?`; `price_last_iga numeric(10,2)?`; `unit_price_current_coles numeric(12,4)?`; `unit_price_last_coles numeric(12,4)?`; `unit_price_current_woolworths numeric(12,4)?`; `unit_price_last_woolworths numeric(12,4)?`; `unit_price_current_aldi numeric(12,4)?`; `unit_price_last_aldi numeric(12,4)?`; `unit_price_current_iga numeric(12,4)?`; `unit_price_last_iga numeric(12,4)?`; `image_link_side text?`; `image_link_back text?`; `created_at timestamptz`; `updated_at timestamptz`; `prophet_price_pred double precision?`; `prophet_on_sale_pred boolean?`; `xgboost_price_pred double precision?`; `true_value_classification text?` |
| `silver.dim_retailers` | Canonical retailer identity. | `id uuid PK`; `retailer_name text unique`; `website_url text?`; `created_at timestamptz`; `updated_at timestamptz` |
| `silver.fct_product_prices` | Time-based prices for products at retailers. | `id uuid PK part`; `recorded_at timestamptz PK part`; `product_id uuid FK`; `category_id uuid FK`; `retailer_id uuid FK`; `item_name text`; `special_text text?`; `product_url text?`; `price numeric(10,2)`; `unit_price numeric(12,4)?`; `is_on_special boolean?`; `created_at timestamptz` |
| `silver.static_master_coles_products` | DE-owned Coles source/master data; it is not an App runtime or TypeORM migration table. | `id uuid PK`; `product_id text`; `name text`; `brand text`; `description text`; `long_description text?`; `size text?`; `gtin varchar(14)?`; `merchandise_category text`; `online_aisle text?`; `brand_name text?`; `price_now numeric(10,2)?`; `price_was numeric(10,2)?`; `price_comparable text?`; `variations_json jsonb`; `images_json jsonb`; `local_image_paths text?`; `image_count integer`; `url text`; `scraped_at timestamptz`; `scrape_status text` |
| `silver.demo_product_pricing_summary` | DE demo/analytics summary outside the App migration scope. | `retailer text`; `run_date date`; `category text`; `product_count integer`; `priced_product_count integer`; `avg_current_price double precision?`; `min_current_price double precision?`; `max_current_price double precision?`; `discounted_product_count integer`; `loaded_at timestamp without time zone` |

The four old MongoDB `stores` documents are represented by the DE-seeded rows in `silver.dim_retailers`; Finalised PostgreSQL intentionally has no duplicate `app.stores` table.

## Finalised PostgreSQL migration/audit tables

These are operational evidence for the migration, not frontend tables.

| Table | What it does | Fields |
| --- | --- | --- |
| `migration.runs` | Execution status and counts for each migration/reconciliation phase. | `id uuid PK`; `migration_name text`; `phase text`; `source_database text?`; `status text`; `last_scanned_source text?`; `source_count bigint`; `migrated_count bigint`; `rejected_count bigint`; `blocked_count bigint`; `failed_count bigint`; `warning_count bigint`; `error_summary jsonb?`; `options jsonb?`; `started_at timestamptz`; `completed_at timestamptz?` |
| `migration.entity_id_map` | Stable source-ID-to-PostgreSQL-UUID mapping. | `source_system text PK part`; `source_collection text PK part`; `source_id text PK part`; `target_schema text PK part`; `target_table text PK part`; `target_id uuid`; `migration_run_id uuid? FK`; `source_checksum text?`; `migrated_at timestamptz` |
| `migration.record_outcomes` | One terminal result for each scanned source document in a run. | `id uuid PK`; `migration_run_id uuid FK`; `source_system text`; `source_collection text`; `source_id text`; `source_checksum text?`; `outcome text`; `primary_reason_code text?`; `target_schema text?`; `target_table text?`; `target_id uuid?`; `details jsonb`; `created_at timestamptz`; `updated_at timestamptz` |
| `migration.record_issues` | Validation, normalization, identity, and technical evidence attached to outcomes. | `id uuid PK`; `record_outcome_id uuid FK`; `issue_type text`; `severity text`; `reason_code text`; `source_field text?`; `details jsonb`; `created_at timestamptz` |
| `migration.reference_resolution_issues` | Required and optional unresolved-reference evidence. | `id uuid PK`; `record_outcome_id uuid? FK`; `migration_run_id uuid? FK`; `source_system text`; `source_collection text`; `source_id text?`; `source_field text`; `source_value text?`; `target_schema text`; `target_table text`; `target_field text`; `reason_code text`; `required boolean`; `details jsonb`; `resolved_target_id uuid?`; `resolved_at timestamptz?`; `created_at timestamptz` |
| `migration.reconciliation_results` | Counts, amounts, uniqueness, and relationship checks after a phase. | `id uuid PK`; `migration_run_id uuid FK`; `entity_type text`; `check_name text`; `source_value jsonb?`; `target_value jsonb?`; `passed boolean`; `details jsonb?`; `checked_at timestamptz` |
| `migration.catalog_source_keys` | Alias lookup from old/external identifiers to the same canonical category/product UUID. It moved from `app`; it did not become another catalogue. | `entity_type text PK part`; `source_system text PK part`; `source_collection text PK part`; `identifier_type text PK part`; `identifier_value text PK part`; `entity_id uuid logical FK`; `source_checksum text?`; `created_at timestamptz`; `updated_at timestamptz` |
| `migration.product_price_source_records` | Source-record lineage for canonical Silver price facts. It moved from `app`. | `source_system text PK part`; `source_collection text PK part`; `source_record_id text PK part`; `price_fact_id uuid logical FK`; `price_recorded_at timestamptz`; `best_price numeric(10,2)?`; `raw_unit_price text?`; `raw_best_unit_price text?`; `raw_store_chain text?`; `source_name text?`; `source_checksum text?`; `source_created_at timestamptz?`; `source_updated_at timestamptz?`; `created_at timestamptz`; `updated_at timestamptz` |
| `migration.finalised_schema_field_backup` | Restricted reversible backup of every field removed by finalisation. It exists only while Finalised PostgreSQL is applied. | `table_name text PK part`; `record_id text PK part`; `fields jsonb`; `backed_up_at timestamptz` |

The lineage tables may be kept for audit/traceability after cutover. If policy later permits deleting them, that should be a separate retention decision—not part of removing MongoDB compatibility from controllers.

## Public version ledgers

| Table | What it does | Fields |
| --- | --- | --- |
| `public.typeorm_migrations` | Applied Migration PostgreSQL/App DDL revisions. | `id serial PK`; `timestamp bigint`; `name varchar` |
| `public.typeorm_finalised_migrations` | Records that the Finalised PostgreSQL revision is applied. | `id serial PK`; `timestamp bigint`; `name varchar` |
| `public.alembic_version` | Current DE/Alembic Silver revision. | `version_num varchar(32) PK` |

These three tables should not be joined into one: the Migration PostgreSQL TypeORM track, Finalised PostgreSQL TypeORM track, and Alembic are independent.

## Preserving the current frontend contract

Removing a database compatibility field does not require immediately renaming a frontend response. A controller or serializer can keep the current API names:

| Frontend/API value | Finalised PostgreSQL source |
| --- | --- |
| `read` | Return `app.notifications.is_read` as `read`. |
| `categoryKey` / `categoryLabel` | Return `alert_segments.category_key` / `category_label` or notification equivalents. |
| retailer key such as `woolworths` | Join the stored retailer UUID to `silver.dim_retailers`, then normalize its name. |
| category description/icon/order | Join `silver.dim_categories` to `app.category_metadata` on the shared UUID. |
| product description/primary image | Join `silver.dim_products` to `app.product_metadata` on the shared UUID. |
| `triggeredCount` / `unread_count` | Compute with a query; these were never stored columns. |

That controller adaptation must be completed before the application uses the Finalised PostgreSQL. The current Mongo copy phases and migration-stage repositories expect Migration PostgreSQL names, so revert the finalisation before rerunning them.

## Apply, inspect, or return to Migration PostgreSQL

```bash
# Read-only proposed result and safety checks
npm run db:finalised:preview

# Apply the clean names/fields after all checks pass
npm run db:finalised:apply

# Restore all Migration PostgreSQL table names, fields, constraints, and saved values
npm run db:finalised:revert
```

Back up PostgreSQL before using `apply` outside local development. Apply is blocked when a required reference failure or active data-migration run remains. Standalone pricing snapshots are valid history and do not block finalisation.
