const { DataSource } = require('typeorm');
const { buildConnectionOptions } = require('./app-data-source');
const {
  ApplyFinalisedPostgreSQL1786579200007,
} = require('./initialising_database/1786579200007-ApplyFinalisedPostgreSQL');

const FinalisedDataSource = new DataSource({
  type: 'postgres',
  ...buildConnectionOptions(),
  entities: [],
  migrations: [ApplyFinalisedPostgreSQL1786579200007],
  synchronize: false,
  migrationsRun: false,
  migrationsTableName: 'typeorm_finalised_migrations',
  migrationsTransactionMode: 'each',
  logging: false,
});

module.exports = { FinalisedDataSource };
