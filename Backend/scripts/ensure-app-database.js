const { Client } = require('pg');

function getDatabaseName(connectionString) {
  const url = new URL(connectionString);
  const name = decodeURIComponent(url.pathname.replace(/^\//, '')).trim();
  if (!name) throw new Error('APP_DATABASE_URL must include a database name');
  return name;
}

function isLocalDatabaseUrl(connectionString) {
  const host = new URL(connectionString).hostname.toLowerCase();
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function buildCreateDatabaseSql(databaseName) {
  return `CREATE DATABASE "${String(databaseName).replaceAll('"', '""')}"`;
}

async function ensureAppDatabase({ connectionString = process.env.APP_DATABASE_URL } = {}) {
  if (!connectionString) throw new Error('APP_DATABASE_URL is not configured');
  if (!isLocalDatabaseUrl(connectionString) && process.env.ALLOW_APP_DATABASE_CREATE !== 'true') {
    throw new Error('Refusing to create a remote App database. Provision it through your deployment platform or set ALLOW_APP_DATABASE_CREATE=true explicitly.');
  }

  const databaseName = getDatabaseName(connectionString);
  const maintenanceUrl = new URL(connectionString);
  maintenanceUrl.pathname = '/postgres';
  const client = new Client({ connectionString: maintenanceUrl.toString() });

  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (existing.rowCount > 0) {
      console.log(`App PostgreSQL database already exists: ${databaseName}`);
      return false;
    }

    await client.query(buildCreateDatabaseSql(databaseName));
    console.log(`Created App PostgreSQL database: ${databaseName}`);
    return true;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  ensureAppDatabase().catch((error) => {
    console.error(`Unable to prepare App PostgreSQL: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildCreateDatabaseSql,
  ensureAppDatabase,
  getDatabaseName,
  isLocalDatabaseUrl,
};
