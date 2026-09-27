const path = require('path');
const { DataSource } = require('typeorm');
const entities = require('./entities');
const {
  CreateMigrationInfrastructure1786579200001,
} = require('./initialising_database/1786579200001-CreateMigrationInfrastructure');

const {
  CreateUserDomain1786579200002,
} = require('./initialising_database/1786579200002-CreateUserDomain');

const {
  CreateShoppingListDomain1786579200003,
} = require('./initialising_database/1786579200003-CreateShoppingListDomain');

const {
  CreateAlertsAndNotificationsDomain1786579200004,
} = require('./initialising_database/1786579200004-CreateAlertsAndNotificationsDomain');

const {
  CreateCatalogPricingCompatibility1786579200005,
} = require('./initialising_database/1786579200005-CreateCatalogPricingCompatibility');

const {
  AddReferenceResolutionAudit1786579200006,
} = require('./initialising_database/1786579200006-AddReferenceResolutionAudit');

const {
  CreateSupportDomain1786579200008,
} = require('./initialising_database/1786579200008-CreateSupportDomain');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({
    path: path.join(__dirname, '..', '..', '..', '.env'),
  });
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return String(value).trim().toLowerCase() === 'true';
}

function buildConnectionOptions() {
  const connectionUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const sslMode = String(process.env.PGSSLMODE || '').trim().toLowerCase();
  const ssl = sslMode && sslMode !== 'disable'
    ? {
      rejectUnauthorized: parseBoolean(
        process.env.PGSSL_REJECT_UNAUTHORIZED,
        sslMode === 'verify-full',
      ),
    }
    : false;

  if (connectionUrl) {
    return { url: connectionUrl, ssl };
  }

  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    username: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'password',
    database: process.env.PGDATABASE || 'discountmate',
    ssl,
  };
}

const AppDataSource = new DataSource({
  type: 'postgres',
  ...buildConnectionOptions(),
  entities,
  migrations: [
    CreateMigrationInfrastructure1786579200001,
    CreateUserDomain1786579200002,
    CreateShoppingListDomain1786579200003,
    CreateAlertsAndNotificationsDomain1786579200004,
    CreateCatalogPricingCompatibility1786579200005,
    AddReferenceResolutionAudit1786579200006,
    CreateSupportDomain1786579200008,
  ],
  synchronize: false,
  migrationsRun: false,
  migrationsTableName: 'typeorm_migrations',
  migrationsTransactionMode: 'each',
  logging: parseBoolean(process.env.TYPEORM_LOGGING, false),
});

module.exports = { AppDataSource, buildConnectionOptions };
