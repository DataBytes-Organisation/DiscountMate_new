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


## Initialising local database of Mongo DiscountMate_DB

1. Set archive path after copying and ensuring the folder and it's files are in Backend folder from DiscountMate Teams: 
```bash
MONGO_ARCHIVE=".local-backups/mongodb/DiscountMate_DB_${BACKUP_STAMP}.archive.gz"
```

2. Set the URI of running local MongoDB. 
```bash
LOCAL_MONGO_URI="mongodb://127.0.0.1:27017 (example of local MongoDB database running)"
```

3. This command is optional and is for deleting the DiscountMate_DB which exists locally on the provided URI saved in value LOCAL_MONGO_URI
```bash
mongosh "$LOCAL_MONGO_URI/DiscountMate_DB" \
  --quiet \
  --eval 'db.dropDatabase()'
```

4. Initialising DiscountMate_DB locally: 
```bash
mongorestore \
  --uri="$LOCAL_MONGO_URI" \
  --archive="$MONGO_ARCHIVE" \
  --gzip \
  --nsInclude='DiscountMate_DB.*'
```

5. Remove variables: 
```bash
unset MONGO_ARCHIVE
unset LOCAL_MONGO_URI
```

Optional commands: Verify expected collections and counts are present:

```bash
mongosh "$LOCAL_MONGO_URI/DiscountMate_DB" --quiet --eval '
  db.getCollectionNames().sort().forEach((name) => {
    print(`${name}: ${db.getCollection(name).countDocuments({})}`);
  });
'
```

To make the backend or migration read the local copy, ensure variables are in .env file.
Example:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB_NAME=DiscountMate_DB
```
## Archiving and saving a file archive copy of MongoDB DiscountMate Database: 

1. Create folder which is preset to be ignored by Git: 
```bash
mkdir -p .local-backups/mongodb
```

2. Set the Mongo URI of the MongoDB DiscountMate Database, TIMESTAMP, and MONGO_ARCHIVE variables:
```bash
MONGO_SOURCE_URI="input in MongoDB URI here"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
MONGO_ARCHIVE=".local-backups/mongodb/DiscountMate_DB_${TIMESTAMP}.archive.gz"
```

3. Create the file archive
```bash
mongodump \
  --uri="$MONGO_SOURCE_URI" \
  --db=DiscountMate_DB \
  --archive="$MONGO_ARCHIVE" \
  --gzip
```

4. Remove the variables
```bash
unset MONGO_SOURCE_URI
unset TIMESTAMP
unset MONGO_ARCHIVE
```
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

## PostgreSQL migration

The API is moving from MongoDB to PostgreSQL feature by feature. Current
controllers still write to MongoDB; the migration tooling prepares and
backfills PostgreSQL.

After completing the setup instructions, run the complete migration with:

```bash
npm run migrate:all
```

See [src/migration/README.md](src/migration/README.md) for setup instructions,
the local DE Docker configuration, architecture details, and available
migration commands.

The optional read-only PostgreSQL catalogue API works with either the migration
schema or the finalised schema and automatically selects the complete read model
available when the backend starts. See
[src/postgres-catalogue/README.md](src/postgres-catalogue/README.md) for its
table mappings, routes, and tests.

The editable legacy MongoDB ERD is
[legacy-mongodb-schema.drawio](src/migration/diagrams/legacy-mongodb-schema.drawio),
with its scope and legend documented in
[LEGACY_MONGODB_SCHEMA.md](src/migration/LEGACY_MONGODB_SCHEMA.md).

The PostgreSQL ERDs cover the
[migration schema](src/migration/diagrams/migration-postgresql-schema.drawio)
and the
[finalised schema](src/migration/diagrams/finalised-postgresql-schema.drawio).
