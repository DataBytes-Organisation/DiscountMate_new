function parseBoolean(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function getPostgresCatalogueConfig(env = process.env) {
  const connectionString = String(env.DE_DATABASE_URL || '').trim();
  return {
    requested: parseBoolean(env.POSTGRES_CATALOG_ENABLED),
    configured: Boolean(connectionString),
    connectionString,
    poolSize: positiveInteger(env.POSTGRES_CATALOG_POOL_SIZE, 8, 30),
    queryTimeoutMs: positiveInteger(env.POSTGRES_CATALOG_QUERY_TIMEOUT_MS, 5000, 30000),
    connectionTimeoutMs: positiveInteger(
      env.POSTGRES_CATALOG_CONNECTION_TIMEOUT_MS,
      5000,
      30000,
    ),
    sslRequired: String(env.PGSSLMODE || '').toLowerCase() === 'require',
  };
}

module.exports = { getPostgresCatalogueConfig, parseBoolean, positiveInteger };
