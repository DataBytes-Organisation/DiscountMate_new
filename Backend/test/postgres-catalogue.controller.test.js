const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sendCatalogueError,
} = require('../src/postgres-catalogue/routers/postgres-catalogue.router');
const {
  PostgresCatalogueError,
} = require('../src/postgres-catalogue/services/postgres-catalogue.service');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('returns controlled contract errors', () => {
  const response = responseRecorder();
  sendCatalogueError(
    new PostgresCatalogueError('INVALID_UUID', 'Invalid UUID.', 400),
    response,
  );
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    error: { code: 'INVALID_UUID', message: 'Invalid UUID.' },
  });
});

test('does not leak raw PostgreSQL errors', () => {
  const response = responseRecorder();
  const originalError = console.error;
  console.error = () => {};
  try {
    sendCatalogueError(
      new Error('password authentication failed for secret-user'),
      response,
    );
  } finally {
    console.error = originalError;
  }
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error.code, 'POSTGRES_CATALOG_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(response.body), /secret-user/);
});
