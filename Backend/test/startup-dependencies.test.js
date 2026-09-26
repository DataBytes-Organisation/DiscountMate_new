const test = require('node:test');
const assert = require('node:assert/strict');

const {
  initializeMongoDependency,
  initializeReverseImageSearchDependency,
  mongoRequiredAtStartup,
} = require('../src/services/startupDependencies');

test('development startup remains available when MongoDB cannot connect', async () => {
  const messages = [];
  const result = await initializeMongoDependency({
    initialize: async () => {
      const error = new Error('querySrv ECONNREFUSED');
      error.code = 'ECONNREFUSED';
      throw error;
    },
    env: { NODE_ENV: 'development' },
    logger: { warn: (message) => messages.push(message) },
  });

  assert.deepEqual(result, { available: false, errorCode: 'ECONNREFUSED' });
  assert.match(messages[0], /degraded mode/i);
});

test('production startup remains fail-fast for MongoDB unless explicitly overridden', async () => {
  assert.equal(mongoRequiredAtStartup({ NODE_ENV: 'production' }), true);
  assert.equal(mongoRequiredAtStartup({
    NODE_ENV: 'production',
    MONGO_REQUIRED_AT_STARTUP: 'false',
  }), false);

  await assert.rejects(
    () => initializeMongoDependency({
      initialize: async () => { throw new Error('Mongo unavailable'); },
      env: { NODE_ENV: 'production' },
      logger: { warn() {} },
    }),
    /Mongo unavailable/,
  );
});

test('backend startup remains available when the optional reverse-image sidecar fails', async () => {
  const messages = [];
  const result = await initializeReverseImageSearchDependency({
    initialize: async () => {
      const error = new Error('operation not permitted while binding port 8001');
      error.code = 'EACCES';
      throw error;
    },
    env: { NODE_ENV: 'development' },
    logger: { warn: (message) => messages.push(message) },
  });

  assert.deepEqual(result, { available: false, errorCode: 'EACCES' });
  assert.match(messages[0], /reverse image search is unavailable/i);
});
