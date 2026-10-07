const { Pool } = require('pg');
let pools;

function getPostgresPools() {
  if (!pools) {
    pools = {
      de: createPool(process.env.DE_DATABASE_URL, 'discountmate-comparison-de'),
      app: createPool(process.env.APP_DATABASE_URL, 'discountmate-comparison-app'),
    };
  }

  return pools;
}

function createPool(connectionString, applicationName) {
  if (!connectionString) return null;

  const pool = new Pool({
    connectionString,
    application_name: applicationName,
    max: Number(process.env.COMPARISON_PG_POOL_SIZE || 8),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });

  pool.on('error', (error) => {
    console.error(`Postgres pool "${applicationName}" reported an idle client error:`, error);
  });

  return pool;
}

async function closePostgresPools() {
  if (!pools) return;
  await Promise.all(Object.values(pools).filter(Boolean).map((pool) => pool.end()));
  pools = undefined;
}

module.exports = { closePostgresPools, getPostgresPools };
