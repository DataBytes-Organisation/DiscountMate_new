const { DataSource } = require('typeorm');
const { getPostgresCatalogueConfig } = require('../config/postgres-catalogue.config');
const CORE_TABLES = [
  'silver.dim_products',
  'silver.dim_categories',
  'silver.dim_retailers',
  'silver.fct_product_prices',
];

const READ_MODEL_TABLES = {
  finalised: [
    'app.category_metadata',
    'app.product_metadata',
    'app.product_price_metadata',
  ],
  migration: [
    'app.category_api_compatibility',
    'app.product_api_compatibility',
    'app.product_price_source_records',
  ],
};

const DISCOVERY_TABLES = [
  ...CORE_TABLES,
  ...READ_MODEL_TABLES.finalised,
  ...READ_MODEL_TABLES.migration,
];

let catalogueDataSource;
let catalogueReadModel;
let capability = {
  requested: false,
  configured: false,
  available: false,
  reason: 'disabled',
};

function detectCatalogueReadModel(rows) {
  const presentTables = new Set(
    rows
      .filter((row) => row.present)
      .map((row) => row.table_name),
  );

  const missingCoreTables = CORE_TABLES.filter((table) => !presentTables.has(table));

  if (missingCoreTables.length > 0) {
    return { name: null, missingCoreTables, missingMetadataTables: [] };
  }

  for (const name of ['finalised', 'migration']) {
    const missingMetadataTables = READ_MODEL_TABLES[name]
      .filter((table) => !presentTables.has(table));

    if (missingMetadataTables.length === 0) {
      return { name, missingCoreTables: [], missingMetadataTables: [] };
    }
  }

  return {
    name: null,
    missingCoreTables: [],
    missingMetadataTables: [
      ...READ_MODEL_TABLES.finalised.filter((table) => !presentTables.has(table)),
      ...READ_MODEL_TABLES.migration.filter((table) => !presentTables.has(table)),
    ],
  };
}

function buildDataSource(config = getPostgresCatalogueConfig()) {
  return new DataSource({
    type: 'postgres',
    url: config.connectionString,
    applicationName: 'discountmate-postgres-catalogue',
    entities: [],
    synchronize: false,
    migrationsRun: false,
    logging: false,
    ssl: config.sslRequired ? { rejectUnauthorized: false } : undefined,
    extra: {
      max: config.poolSize,
      connectionTimeoutMillis: config.connectionTimeoutMs,
      statement_timeout: config.queryTimeoutMs,
      query_timeout: config.queryTimeoutMs,
      idleTimeoutMillis: 30000,
      options: '-c default_transaction_read_only=on',
    },
  });
}

async function initializePostgresCatalogue() {
  const config = getPostgresCatalogueConfig();
  catalogueReadModel = undefined;
  capability = {
    requested: config.requested,
    configured: config.configured,
    available: false,
    reason: config.requested ? 'not_configured' : 'disabled',
  };

  if (!config.requested || !config.configured) {
    return getPostgresCatalogueCapability();
  }

  try {
    catalogueDataSource = buildDataSource(config);
    await catalogueDataSource.initialize();
    const rows = await catalogueDataSource.query(
      `SELECT name AS table_name, to_regclass(name) IS NOT NULL AS present
       FROM unnest($1::text[]) AS required(name)`,
      [DISCOVERY_TABLES],
    );

    const detectedReadModel = detectCatalogueReadModel(rows);

    if (!detectedReadModel.name) {
      const missing = [
        ...detectedReadModel.missingCoreTables,
        ...detectedReadModel.missingMetadataTables,
      ];
      throw new Error(
        `Required PostgreSQL catalogue read model is missing: ${missing.join(', ')}`,
      );
    }
    catalogueReadModel = detectedReadModel.name;

    capability = {
      requested: true,
      configured: true,
      available: true,
      reason: null,
    };
    console.log(`PostgreSQL catalogue is available (${catalogueReadModel} schema).`);
  } catch (error) {
    console.error('PostgreSQL catalogue is unavailable:', error.message);
    capability = {
      requested: true,
      configured: true,
      available: false,
      reason: 'connection_failed',
    };

    if (catalogueDataSource?.isInitialized) {
      await catalogueDataSource.destroy();
    }
    catalogueDataSource = undefined;
    catalogueReadModel = undefined;
  }

  return getPostgresCatalogueCapability();
}

function getPostgresCatalogueDataSource() {
  if (!catalogueDataSource?.isInitialized) {
    throw new Error('PostgreSQL catalogue data source is not initialized.');
  }

  return catalogueDataSource;
}

function getPostgresCatalogueCapability() {
  return { ...capability };
}

function getPostgresCatalogueReadModel() {
  if (!catalogueReadModel) {
    throw new Error('PostgreSQL catalogue read model is not initialized.');
  }

  return catalogueReadModel;
}

async function closePostgresCatalogue() {
  if (catalogueDataSource?.isInitialized) {
    await catalogueDataSource.destroy();
  }
  catalogueDataSource = undefined;
  catalogueReadModel = undefined;
  capability = {
    requested: false,
    configured: false,
    available: false,
    reason: 'disabled',
  };
}

module.exports = {
  CORE_TABLES,
  DISCOVERY_TABLES,
  READ_MODEL_TABLES,
  buildDataSource,
  closePostgresCatalogue,
  detectCatalogueReadModel,
  getPostgresCatalogueCapability,
  getPostgresCatalogueDataSource,
  getPostgresCatalogueReadModel,
  initializePostgresCatalogue,
};
