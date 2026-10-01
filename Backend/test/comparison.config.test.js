const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertComparisonConfiguration,
  assertComparisonDatabaseConnections,
  isComparisonV2Enabled,
} = require('../src/comparison/config/comparison.config');

test('production comparison is enabled only by an explicit true flag', () => {
  assert.equal(isComparisonV2Enabled({ NODE_ENV: 'production' }), false);
  assert.equal(isComparisonV2Enabled({ NODE_ENV: 'production', COMPARISON_V2_ENABLED: 'false' }), false);
  assert.equal(isComparisonV2Enabled({ NODE_ENV: 'production', COMPARISON_V2_ENABLED: 'true' }), true);
});

test('development preserves the local default unless explicitly disabled', () => {
  assert.equal(isComparisonV2Enabled({ NODE_ENV: 'development' }), true);
  assert.equal(isComparisonV2Enabled({ NODE_ENV: 'development', COMPARISON_V2_ENABLED: 'false' }), false);
});

test('enabled production comparison requires both database URLs', () => {
  assert.throws(
    () => assertComparisonConfiguration({ NODE_ENV: 'production', COMPARISON_V2_ENABLED: 'true' }),
    /DE_DATABASE_URL and APP_DATABASE_URL/
  );
  assert.throws(
    () => assertComparisonConfiguration({
      NODE_ENV: 'production',
      COMPARISON_V2_ENABLED: 'true',
      DE_DATABASE_URL: 'postgresql:\/\/de',
    }),
    /APP_DATABASE_URL/
  );
  assert.doesNotThrow(() => assertComparisonConfiguration({
    NODE_ENV: 'production',
    COMPARISON_V2_ENABLED: 'true',
    DE_DATABASE_URL: 'postgresql:\/\/de',
    APP_DATABASE_URL: 'postgresql:\/\/app',
  }));
});

test('disabled production comparison does not require database URLs', () => {
  assert.doesNotThrow(() => assertComparisonConfiguration({
    NODE_ENV: 'production',
    COMPARISON_V2_ENABLED: 'false',
  }));
});

test('comparison startup verifies both DE and App database connections', async () => {
  const queries = [];
  const pools = {
    de: { query: async (sql) => queries.push(['de', sql]) },
    app: { query: async (sql) => queries.push(['app', sql]) },
  };

  await assertComparisonDatabaseConnections(pools);

  assert.deepEqual(queries, [
    ['de', 'SELECT 1'],
    ['app', 'SELECT 1'],
  ]);
});

test('comparison startup reports which required database cannot connect', async () => {
  const pools = {
    de: { query: async () => ({ rows: [{ '?column?': 1 }] }) },
    app: { query: async () => { throw new Error('password authentication failed'); } },
  };

  await assert.rejects(
    assertComparisonDatabaseConnections(pools),
    /App PostgreSQL connection failed/
  );
});
