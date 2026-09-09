# Migration PostgreSQL

This is the schema used immediately after the MongoDB-to-PostgreSQL copy. It is
deliberately able to preserve the current API behaviour and imperfect historical
records. Migration-stage compatibility does **not** mean that every table is temporary.

## The four schemas

| Schema | Owner | What belongs here |
| --- | --- | --- |
| `app` | Backend / TypeORM | Runtime users, subscriptions, receipts, lists, alerts, notifications, support requests, and API metadata. |
| `silver` | DE / Alembic | Canonical categories, products, retailers, and product-price facts. |
| `migration` | Migration CLI | Run history, Mongo-to-UUID mappings, warnings, and reconciliation evidence. Not API data. |
| `public` | TypeORM / Alembic | Version ledgers only. |

`UUID FK` below means a UUID intended to identify another row. Some App-to-Silver references are verified by reconciliation rather than a physical PostgreSQL foreign-key constraint so DE can manage Silver independently.

## What eventually changes

| Migration PostgreSQL object | Finalised PostgreSQL outcome | Why |
| --- | --- | --- |
| `app.category_api_compatibility` | Rename to `app.category_metadata` | Description/icon/order are real App fields; only the name is temporary. |
| `app.product_api_compatibility` | Rename to `app.product_metadata` | Description/primary image are real App fields; legacy parsing fields are removed. |
| `app.user_legacy_metrics` | Rename to `app.user_metrics` | The metrics are real; `legacy` is only an old name. |
| `app.notification_product_references` | Rename to `app.notification_products` | This is a real many-to-many bridge; only the name and legacy alias field change. |
| `app.catalog_source_keys` | Move to `migration.catalog_source_keys` | It translates Mongo/product-code/GTIN aliases; it is not an API table. |
| `app.product_price_source_records` | Move to `migration.product_price_source_records` | It is source-lineage/audit data for Silver price facts. |
| `legacy_*`, selected `*_key`, and `raw_payload` fields | Archive, then remove | They exist for migration/API fallback, not as canonical relationships. |

Everything else remains unless a later product decision changes it.

## App tables

### Users and subscriptions

| Table | Purpose | Fields |
| --- | --- | --- |
| `app.users` | Login identity and account state. One row per user. | `id uuid PK`; `email citext unique`; `password_hash text`; `role text`; `status text`; `email_verified_at timestamptz?`; `phone_verified_at timestamptz?`; `password_changed_at timestamptz?`; `created_at timestamptz`; `updated_at timestamptz` |
| `app.user_profiles` | Optional personal/profile attributes separated from authentication. | `user_id uuid PK/FK`; `first_name varchar?`; `last_name varchar?`; `phone_number varchar?`; `address text?`; `postcode char(4)?`; `date_of_birth date?`; `bio text?`; `legacy_profile_id text?`; `created_at`; `updated_at` |
| `app.user_profile_images` | Binary profile image belonging to a user. | `user_id uuid PK/FK`; `mime_type varchar`; `image_data bytea`; `created_at`; `updated_at` |
| `app.user_notification_preferences` | Per-user switches for notification delivery/features. | `user_id uuid PK/FK`; `price_alerts_enabled boolean`; `weekly_summary_enabled boolean`; `browser_notifications_enabled boolean`; `updated_at` |
| `app.user_dashboard_preferences` | Selected list and retailer for the dashboard. | `user_id uuid PK/FK`; `selected_list_id uuid FK?`; `selected_retailer_id uuid?`; `legacy_selected_list_id text?`; `selected_retailer_key text`; `created_at`; `updated_at` |
| `app.user_legacy_metrics` | Savings/trip/list counters displayed by the App. The data stays; the table is renamed in Finalised PostgreSQL. | `user_id uuid PK/FK`; `total_saved numeric`; `shopping_trips integer`; `shopping_lists_count integer`; `updated_at` |
| `app.subscription_plans` | Plan catalogue and enforced/displayed limits. Seeded with `free`, `premium`, and `family`. | `code text PK`; `display_name text`; `price_cents integer`; `currency char(3)`; `billing_interval text`; `price_suffix text`; `badge text?`; `max_active_alerts integer?`; `max_saved_lists integer?`; `is_active boolean`; `display_order integer`; `created_at`; `updated_at` |
| `app.subscription_plan_features` | Ordered marketing/feature bullets for each plan. | `id uuid PK`; `plan_code text FK`; `display_text text`; `display_order integer` |
| `app.user_subscriptions` | Subscription history. At most one `active` row per user. | `id uuid PK`; `user_id uuid FK`; `plan_code text FK`; `status text` (`active`, `cancelled`, `ended`); `source text`; `provider_customer_id text?`; `provider_subscription_id text?`; `started_at`; `current_period_start?`; `current_period_end?`; `cancelled_at?`; `ended_at?`; `created_at`; `updated_at` |

### Receipts

| Table | Purpose | Fields |
| --- | --- | --- |
| `app.receipts` | Receipt header/history belonging to a user. `store_name` is the historical label; `retailer_id` is the canonical Silver UUID when recognized. | `id uuid PK`; `user_id uuid FK`; `retailer_id uuid?`; `store_name text`; `receipt_number text?`; `purchased_at?`; `uploaded_at`; `subtotal numeric?`; `total numeric?`; `savings numeric?`; `source text`; `created_at`; `updated_at`; `source_receipt_key text? unique`; `raw_payload jsonb?` |
| `app.receipt_items` | Ordered lines belonging to a receipt. | `id uuid PK`; `receipt_id uuid FK`; `line_number integer`; `item_name text?`; `quantity numeric`; `unit_price numeric?`; `line_total numeric?`; `matched_product_id uuid?`; `created_at`; `raw_payload jsonb?` |

### Shopping lists and pricing history

| Table | Purpose | Fields |
| --- | --- | --- |
| `app.shopping_lists` | Current saved lists owned by users. | `id uuid PK`; `user_id uuid FK`; `name text`; `description text`; `accent text`; `is_active boolean`; `total numeric`; `savings numeric`; `created_at`; `updated_at` |
| `app.shopping_list_items` | Ordered list lines. A product/category/retailer UUID is canonical when resolved; copied names/prices keep historical and unmatched lines usable. | `id uuid PK`; `shopping_list_id uuid FK`; `line_number integer`; `product_id uuid?`; `product_name text`; `quantity integer`; `unit_price numeric`; `retailer_id uuid?`; `image_url text?`; `category_id uuid?`; `category_name text?`; `retailer_prices jsonb`; `created_at`; `legacy_product_identifier text`; `selected_retailer_key text?`; `legacy_category_identifier text?`; `raw_payload jsonb?` |
| `app.list_pricing_snapshots` | A historical calculation of list totals across retailers. The nullable list relationship preserves history after a list is deleted or when only a legacy saved-list reference exists. | `id uuid PK`; `user_id uuid FK`; `shopping_list_id uuid?`; `list_name text`; `selected_retailer_id uuid?`; `retailer_totals jsonb`; `comparison_status text`; `comparable_retailer_count integer`; `available_retailers text[]`; `cheapest_retailer_id uuid?`; `cheapest_total numeric`; `highest_retailer_id uuid?`; `highest_total numeric`; `selected_total numeric`; `total_saved numeric`; `savings_rate numeric`; `comparison_label text`; `item_count integer`; `source text`; `created_at`; `updated_at`; `legacy_shopping_list_id text`; `selected_retailer_key text?`; `cheapest_retailer_key text?`; `highest_retailer_key text?`; `raw_payload jsonb?` |

`comparison_status` is `comparable`, `single_retailer`, `no_pricing`, or `unpriceable`. `retailer_totals` is intentionally JSON because it is a historical snapshot keyed by retailer, not a current canonical relationship.

### Alerts and notifications

| Table | Purpose | Fields |
| --- | --- | --- |
| `app.alert_segments` | A user's active/inactive alert for one category. | `id uuid PK`; `user_id uuid FK`; `category_id uuid?`; `category_key text`; `category_label text`; `active boolean`; `created_at`; `updated_at` |
| `app.notifications` | In-app notification content and read state. | `id uuid PK`; `user_id uuid FK`; `type text`; `title text`; `message text`; `is_read boolean`; `category_id uuid?`; `category_key text?`; `category_label text?`; `cta_route text?`; `deal_key text?`; `source_types text[]`; `created_at`; `updated_at` |
| `app.notification_product_references` | Ordered products referenced by a notification. This table remains as `app.notification_products` after finalisation. | `id uuid PK`; `notification_id uuid FK`; `line_number integer`; `product_id uuid?`; `legacy_product_identifier text` |

### Support requests

| Table | Purpose | Fields |
| --- | --- | --- |
| `app.support_requests` | Prepared PostgreSQL destination for Mongo-backed `POST /api/contact`; the repeatable support phase copies request headers here. Historical unauthenticated submissions keep `user_id` null instead of inferring ownership from an email address. | `id uuid PK`; `reference_number text unique`; `user_id uuid FK?`; `name text`; `email citext`; `topic text`; `subject text?`; `message text`; `support_email citext`; `email_status text` (`sent`, `failed`, `not_configured`); `status text` (`received`, `in_progress`, `resolved`, `closed`); `created_at timestamptz`; `updated_at timestamptz` |
| `app.support_request_attachments` | At most one optional PNG/JPEG/PDF attachment per request. The nested Mongo object is normalized into a child row. | `id uuid PK`; `support_request_id uuid FK unique`; `original_name text`; `mime_type text`; `size_bytes integer`; `data bytea`; `created_at timestamptz` |

### Catalogue/API bridges and price lineage

| Table | Purpose | Fields |
| --- | --- | --- |
| `app.catalog_source_keys` | Alias resolver. Multiple identifiers can point to the **same** `silver.dim_products.id` or `silver.dim_categories.id`. It does not contain another product/category. | `entity_type text`; `source_system text`; `source_collection text`; `identifier_type text`; `identifier_value text`; `entity_id uuid`; `source_checksum text?`; `created_at`; `updated_at` |
| `app.category_api_compatibility` | App-owned category fields absent from the fixed DE Silver shape. Shares `category_id` with Silver. This becomes `category_metadata`; it is not deleted. | `category_id uuid PK`; `description text?`; `icon_url text?`; `display_order integer?`; `is_active boolean`; `updated_at` |
| `app.product_api_compatibility` | App-owned product fields absent from the fixed DE Silver shape. Shares `product_id` with Silver. This becomes `product_metadata`; it is not deleted. | `product_id uuid PK`; `description text?`; `image_link_primary text?`; `updated_at`; `legacy_gtin text?`; `legacy_measurement text?` |
| `app.product_price_source_records` | Connects a source Mongo pricing record to its canonical Silver fact and retains source parsing/audit values. It moves to `migration`. | `source_system text`; `source_collection text`; `source_record_id text`; `price_fact_id uuid`; `price_recorded_at timestamptz`; `best_price numeric?`; `raw_unit_price text?`; `raw_best_unit_price text?`; `raw_store_chain text?`; `source_name text?`; `source_checksum text?`; `source_created_at?`; `source_updated_at?`; `created_at`; `updated_at` |

Alias example:

```text
Mongo _id / product_code / GTIN
            ↓
app.catalog_source_keys.entity_id
            ↓ same UUID
silver.dim_products.id
            ↓ same UUID
shopping_list_items.product_id / product metadata / price facts
```

## MongoDB input mapping and allowed values

Compatibility fields remain during migration so existing frontend calls and unmatched historical records continue to work. A later PostgreSQL controller can return the same API field names while reading the normalized columns.

### Users, subscriptions, and receipts

| MongoDB input | PostgreSQL destination / rule |
| --- | --- |
| `_id` | `migration.entity_id_map` → `app.users.id` UUID |
| `email` / `account_user_name` | `app.users.email` (`citext`, unique) |
| `encrypted_password` | `app.users.password_hash`; bcrypt hashes only |
| `role` / `admin` | `app.users.role`: `user` or `admin` |
| names, phone, address, postcode, DOB, bio | `app.user_profiles` |
| `profile_image` | `app.user_profile_images` |
| notification/dashboard preferences | One-to-one preference tables |
| `subscription.plan` / `subscriptionPlan` | Active `app.user_subscriptions`; plan is `free`, `premium`, or `family` |
| `receipt_history[]` | `app.receipts` and `app.receipt_items` |
| receipt `store_name` | Original `store_name` plus resolved `retailer_id` when recognized |
| receipt/item body | Temporary `raw_payload jsonb`; never copied into quarantine payloads |

Canonical retailer keys are `aldi`, `coles`, `iga`, and `woolworths`. Labels such as `Woolworths`, `Woolworths Generic`, and `woolworths_generic` normalize to the same Silver retailer UUID. Unknown labels remain visible but keep a null UUID and produce a redacted warning.

### Shopping lists and comparison snapshots

| MongoDB input | PostgreSQL destination / rule |
| --- | --- |
| list `_id` | ID map → `app.shopping_lists.id` UUID |
| `list_name` / `name` | `app.shopping_lists.name` |
| `accent` | `emerald`, `amber`, `sky`, `violet`, or `rose` |
| list `items[]` | Ordered `app.shopping_list_items` rows |
| item product aliases | `legacy_product_identifier`; nullable resolved `product_id` |
| item `name`, `image`, category | Compatibility/snapshot fields for historical or unmatched items |
| item `price`, `quantity`, `store` | `unit_price`, `quantity`, retailer key/UUID |
| `retailerPrices` | `retailer_prices jsonb` keyed by canonical retailer key |
| pricing snapshot document | `app.list_pricing_snapshots` |
| `comparison_status` | `comparable`, `single_retailer`, `no_pricing`, or `unpriceable` |
| cheapest/highest/selected retailer | Canonical key plus resolved retailer UUID |

### Categories, products, and product pricing

| MongoDB input | PostgreSQL destination / rule |
| --- | --- |
| category `_id`, `category_code` | Aliases in `app.catalog_source_keys` |
| `category_name` | `silver.dim_categories.category_name` |
| category description/icon/order/active | `app.category_api_compatibility` |
| product `_id`, `product_code`, legacy `product_id` | Aliases in `app.catalog_source_keys` |
| valid `gtin` | `silver.dim_products.gtin`; malformed source retained in App compatibility |
| `product_name`, `brand` | Silver product name and brand |
| package quantity/measurement | Normalized Silver fields plus original App label |
| product description/primary image | `app.product_api_compatibility` |
| side/back image and category | Original Silver columns |
| pricing product alias | Resolved through `app.catalog_source_keys` |
| `store_chain` / `retailer` | Resolved `silver.dim_retailers.id`; original in `raw_store_chain` |
| `date`, `price`, `unit_price`, `is_on_special` | `silver.fct_product_prices` |
| `best_price`, raw unit labels, source timestamps | `app.product_price_source_records` |

Silver keeps canonical warehouse fields. Frontend-only, legacy, or source-fidelity values stay in App-owned compatibility tables rather than changing the DE format.

### Alerts and notifications

| MongoDB input | PostgreSQL destination / API behaviour |
| --- | --- |
| alert `_id` | ID map → `app.alert_segments.id` UUID |
| `category_key` / `categoryKey` | `category_key`; API returns `categoryKey` |
| `category_label` / `categoryLabel` | `category_label`; API returns `categoryLabel` |
| `active` | `active` boolean |
| notification `_id` | ID map → `app.notifications.id` UUID |
| `title` / `subject`, `message` / `body`, `type` | Notification content fields |
| `read` | Stored as `is_read`; controller returns `read` |
| related product aliases | Ordered `app.notification_product_references` |

`triggeredCount` and notification `unread_count` are derived query values, not stored columns. The seeded Free plan advertises five active alerts, but the current Mongo controller does not enforce the limit; migration preserves existing state.

### Support requests

| MongoDB input | PostgreSQL destination / rule |
| --- | --- |
| `_id` | ID map → `app.support_requests.id`; Mongo identity is not an App column |
| `referenceNumber` | `app.support_requests.reference_number` |
| `name`, `email`, `topic`, `subject`, `message` | Corresponding request header columns; the current non-empty-email compatibility is preserved |
| `supportEmail`, `emailStatus`, `status` | `support_email`, constrained `email_status`, and constrained workflow `status` |
| `attachment.originalName`, `mimeType`, `size`, `dataBase64` | Child-row `original_name`, `mime_type`, `size_bytes`, and decoded `bytea data` |
| `createdAt`, `updatedAt` | Original timestamps; ObjectId time is only a fallback when creation time is absent |

The phase reconciles request and attachment counts, uniqueness, mappings, and dangling attachment references. Quarantine payloads never contain names, emails, message bodies, or attachment bytes.

## Silver tables

Silver tables are not Mongo compatibility tables. They are the canonical catalogue/pricing structure owned by DE and remain unchanged by App finalisation.

| Table | Purpose | Fields |
| --- | --- | --- |
| `silver.dim_categories` | Canonical category dimension. | `id uuid PK`; `category_name text`; `created_at`; `updated_at` |
| `silver.dim_products` | Canonical product/SKU dimension. Different brands, sizes, flavours, or GTINs may have different UUIDs even when names resemble each other. | `id uuid PK`; `category_id uuid`; `product_name text`; `brand_name text?`; `gtin varchar?`; `pack_quantity numeric?`; `pack_uom text?`; `price_current_coles numeric?`; `price_last_coles numeric?`; `price_current_woolworths numeric?`; `price_last_woolworths numeric?`; `price_current_aldi numeric?`; `price_last_aldi numeric?`; `price_current_iga numeric?`; `price_last_iga numeric?`; `unit_price_current_coles numeric?`; `unit_price_last_coles numeric?`; `unit_price_current_woolworths numeric?`; `unit_price_last_woolworths numeric?`; `unit_price_current_aldi numeric?`; `unit_price_last_aldi numeric?`; `unit_price_current_iga numeric?`; `unit_price_last_iga numeric?`; `image_link_side text?`; `image_link_back text?`; `created_at`; `updated_at`; `prophet_price_pred double?`; `prophet_on_sale_pred boolean?`; `xgboost_price_pred double?`; `true_value_classification text?` |
| `silver.dim_retailers` | Canonical retailer identity used by receipts, lists, snapshots, and prices. | `id uuid PK`; `retailer_name text`; `website_url text?`; `created_at`; `updated_at` |
| `silver.fct_product_prices` | Time-based product price facts. One product can have many facts across retailers and dates. | `id uuid`; `recorded_at timestamptz`; `product_id uuid`; `category_id uuid`; `retailer_id uuid`; `item_name text`; `special_text text?`; `product_url text?`; `price numeric`; `unit_price numeric?`; `is_on_special boolean?`; `created_at` |
| `silver.static_master_coles_products` | DE-owned Coles source/master table, not an App API table and not copied by the TypeORM App migration. | `id`; `product_id`; `name`; `brand`; `description`; `long_description?`; `size?`; `gtin?`; `merchandise_category`; `online_aisle?`; `brand_name?`; `price_now?`; `price_was?`; `price_comparable?`; `variations_json`; `images_json`; `local_image_paths?`; `image_count`; `url`; `scraped_at`; `scrape_status` |
| `silver.demo_product_pricing_summary` | DE demo/analytics summary. It is outside the App migration scope. | `retailer`; `run_date`; `category`; `product_count`; `priced_product_count`; `avg_current_price?`; `min_current_price?`; `max_current_price?`; `discounted_product_count`; `loaded_at` |

Legacy MongoDB `stores` rows are not copied into a second App table. They are replaced by the DE/Alembic-seeded `silver.dim_retailers` rows for Aldi, Coles, IGA, and Woolworths. App migrations normalize old store labels to those UUIDs.

## Migration audit tables

These tables are never frontend/API domain tables.

| Table | Purpose | Fields |
| --- | --- | --- |
| `migration.runs` | One record per copy/reconciliation execution. | `id`; `migration_name`; `phase`; `source_database?`; `status`; `last_scanned_source?`; `source_count`; `migrated_count`; `rejected_count`; `blocked_count`; `failed_count`; `warning_count`; `error_summary jsonb?`; `options jsonb?`; `started_at`; `completed_at?` |
| `migration.entity_id_map` | Stable mapping from a source identity to a PostgreSQL UUID. | `source_system`; `source_collection`; `source_id`; `target_schema`; `target_table`; `target_id`; `migration_run_id?`; `source_checksum?`; `migrated_at` |
| `migration.record_outcomes` | Exactly one terminal result per scanned source document and run. | `id`; `migration_run_id`; `source_system`; `source_collection`; `source_id`; `source_checksum?`; `outcome`; `primary_reason_code?`; `target_schema?`; `target_table?`; `target_id?`; `details jsonb`; `created_at`; `updated_at` |
| `migration.record_issues` | Validation, normalization, identity, and technical details attached to an outcome. | `id`; `record_outcome_id`; `issue_type`; `severity`; `reason_code`; `source_field?`; `details jsonb`; `created_at` |
| `migration.reference_resolution_issues` | Required or optional source references that could not resolve to a PostgreSQL UUID. | `id`; `record_outcome_id?`; `migration_run_id?`; `source_system`; `source_collection`; `source_id?`; `source_field`; `source_value?`; `target_schema`; `target_table`; `target_field`; `reason_code`; `required`; `details jsonb`; `resolved_target_id?`; `resolved_at?`; `created_at` |
| `migration.reconciliation_results` | Count, amount, uniqueness, and relationship checks performed after a phase. | `id`; `migration_run_id`; `entity_type`; `check_name`; `source_value jsonb?`; `target_value jsonb?`; `passed`; `details jsonb?`; `checked_at` |

## Public version ledgers

| Table | Purpose | Fields |
| --- | --- | --- |
| `public.typeorm_migrations` | Records applied Migration PostgreSQL/App TypeORM DDL migrations. | `id`; `timestamp`; `name` |
| `public.typeorm_finalised_migrations` | Records whether Finalised PostgreSQL is currently applied. | `id`; `timestamp`; `name` |
| `public.alembic_version` | Records the DE/Alembic Silver revision. | `version_num` |

## Migration-stage field dictionary

| Field pattern | Why it exists now | Finalised PostgreSQL treatment |
| --- | --- | --- |
| `legacy_*` | Retains an old Mongo/frontend identity when no UUID exists or while auditing. | Archived and removed after the decision/cutover. |
| `raw_payload` | Allows exact source recovery during migration investigation. | Archived and removed. It should not be returned by controllers. |
| `*_key` beside `*_id` | Preserves current API labels such as `coles` while UUID relationships are introduced. | Controller derives the API key/label from the UUID. |
| copied `product_name`, `category_name`, `store_name`, `list_name` | Historical snapshot/fallback,. | Retained unless the product requirements say historical names must change with canonical records. |
| `catalog_source_keys` | Resolves many old/external aliases to one Silver UUID. | Moved to `migration`; not deleted until source migration/integration needs it. |

`?` in the field lists means nullable. `created_at` and `updated_at` are
`timestamptz` unless stated otherwise.
