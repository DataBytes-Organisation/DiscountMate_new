## Start the API

```bash
npm ci
node server.js/ npm start
```

## PostgreSQL migration

The API is moving from MongoDB to PostgreSQL feature by feature. The current controllers, are still configured to write to MongoDB. The migration code only prepares and backfills PostgreSQL.

After completing set up instructions, the complete migration can be run this command:

```bash
npm run migrate:all
```

See [src/migration/README.md](src/migration/README.md) for set up instructions, local DE Docker setup, architecture explanation and further information on available features of the migration script. 
  

The editable ERD of Legacy MongoDB database is [legacy-mongodb-schema.drawio](src/migration/diagrams/legacy-mongodb-schema.drawio), with scope and legend explained in [LEGACY_MONGODB_SCHEMA.md](src/migration/test/LEGACY_MONGODB_SCHEMA.md). 

The two ERDs for PostgreSQL are [Migration PostgreSQL](src/migration/diagrams/migration-postgresql-schema.drawio) and [Finalised PostgreSQL](src/migration/diagrams/finalised-postgresql-schema.drawio).
