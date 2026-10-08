function isComparisonV2Enabled(env = process.env) {
  if (env.COMPARISON_V2_ENABLED === 'true') return true;
  if (env.COMPARISON_V2_ENABLED === 'false') return false;
  return env.NODE_ENV !== 'production';
}

function comparisonRequiresConfiguredDatabases(env = process.env) {
  return isComparisonV2Enabled(env)
    && (env.NODE_ENV === 'production' || env.COMPARISON_V2_ENABLED === 'true');
}

function assertComparisonConfiguration(env = process.env) {
  if (!comparisonRequiresConfiguredDatabases(env)) return;

  const missing = ['DE_DATABASE_URL', 'APP_DATABASE_URL'].filter((name) => !env[name]);
  if (missing.length) {
    throw new Error(
      `Comparison V2 is enabled but required configuration is missing: ${missing.join(' and ')}`
    );
  }
}

async function assertComparisonDatabaseConnections(pools) {
  await verifyPool('DE', pools?.de);
  await verifyPool('App', pools?.app);
}

async function verifyPool(label, pool) {
  if (!pool) throw new Error(`${label} PostgreSQL connection is not configured`);

  try {
    await pool.query('SELECT 1');
  } catch (cause) {
    throw new Error(`${label} PostgreSQL connection failed`, { cause });
  }
}

module.exports = {
  assertComparisonConfiguration,
  assertComparisonDatabaseConnections,
  comparisonRequiresConfiguredDatabases,
  isComparisonV2Enabled,
};
