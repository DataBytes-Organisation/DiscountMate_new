# Legacy MongoDB

The editable source-database diagram is [legacy-mongodb-schema.drawio](../diagrams/legacy-mongodb-schema.drawio). It is a read-only inventory of `DiscountMate_DB`.

## Scope

The database currently has 17 collections. Nine are read by the migration:

| Migration source | Documents | Main contents |
| --- | ---: | --- |
| `users` | 46 | Accounts, profile, preferences, subscription, and embedded receipt history |
| `categories` | 20 | Legacy category records |
| `products` | 25,591 | Legacy product metadata and category references |
| `product_pricings` | 255,555 | Product/store/date price observations |
| `shopping_lists` | 29 | Lists with embedded items and retailer-price snapshots |
| `list_pricing_snapshots` | 59 | Saved list-comparison totals |
| `alert_segments` | 33 | User/category notification segments |
| `notifications` | 0 | In-app notification target; diagram fields come from the backend read/write contract |
| `support_requests` | 12 | Contact request headers with optional embedded attachment metadata/Base64 bytes |

Eight more live collections are shown on **Other collections (not copied)**: `basket`, `favourites`, `saved_lists`, `shopping_list_items`, `stores`, `subcategories`, `user_personas`, and `user_preferences`, as these collections are not migrated. Aldi, Coles, IGA, and Woolworths identities are replaced by DE/Alembic-seeded `silver.dim_retailers`. 

## How to read it

- `ID` is MongoDB `_id`; `UQ` and `IDX` are indexes found on the collection.
- `REF` is a logical reference interpreted by backend or migration code. MongoDB does not enforce it as a foreign key.
- `EMB` is a nested object or array stored inside its parent document.
- `CONTRACT` means the collection was empty, so the field comes from the active backend read/write and migration contract rather than an observed document.
- `x/y sampled docs` says how often the path appeared in the inspected sample. It is not a required/nullability declaration.
- Types are observed BSON/JavaScript types. The scanned collections currently have no JSON-schema validators enforcing those shapes.

The diagram never contains document values, user details, or credentials. It contains collection names, field paths, inferred types, counts, indexes, and logical relationships only. Embedded array paths use `[]`, for example `receipt_history[].items[].matched_product`.
