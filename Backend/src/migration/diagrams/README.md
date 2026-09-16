# Migration diagrams

This directory contains the editable Draw.io sources and exported PNG previews for the MongoDB-to-PostgreSQL migration.

## Files and exports

| Schema stage | Editable source | Page `00` relationship export | Page `01` field-index export |
| --- | --- | --- | --- |
| Legacy MongoDB | `legacy-mongodb-schema.drawio` | `legacy-mongodb-schema-relationships.png` | `legacy-mongodb-schema-allfields.png` |
| Migration PostgreSQL | `migration-postgresql-schema.drawio` | `migration-postgresql-schema-relationships.png` | `migration-postgresql-schema-allfields.png` |
| Finalised PostgreSQL | `finalised-postgresql-schema.drawio` | `finalised-postgresql-schema-relationships.png` | `finalised-postgresql-schema-allfields.png` |

Each Draw.io file contains multiple pages. Page `00` is the relationship overview and is the source of the corresponding `-relationships.png` file. Page `01` is the complete table or collection field index and is the source of the corresponding `-allfields.png` file. Later pages provide detailed views of individual domains.

## Why there are three schemas

The three schemas represent consecutive stages of the database migration:

```text
Legacy MongoDB -> Migration PostgreSQL -> Finalised PostgreSQL
```

- **Legacy MongoDB** represents the existing collections and relationships that are read by the migration scripts.
- **Migration PostgreSQL** represents the PostgreSQL structure used while data is copied, reconciled, and checked. It includes compatibility fields and audit structures that support a safe migration from MongoDB.
- **Finalised PostgreSQL** represents the intended structure after migration and cutover. Migration-only fields are removed, renamed, or relocated while the operational application data is retained.

These are not three independent database designs. The schemas demonstrate how the same data model changes throughout the migration process. Keeping each stage separate makes the design to; distinguish temporary migration structures from long-term application structures, and provides a foundation for future persistence changes and application features.

## Editing and exporting

1. Install a Draw.io-compatible editor, such as the Draw.io Integration extension for Visual Studio Code.
2. Open the relevant `.drawio` file and select the page to update.
3. Make the diagram changes and save the `.drawio` source.
4. To export a page, move it to the first position in the Draw.io document. Select **Export**, enter the filename, and choose the required file type.
5. Move the page back to its original position in the numbered sequence.
6. Review the exported PNG and commit it with the Draw.io source.
