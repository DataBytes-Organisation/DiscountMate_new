const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const loggerPath = require.resolve('../src/utils/securityLogger');
const originalNodeEnv = process.env.NODE_ENV;
const originalWarn = console.warn;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
  console.warn = originalWarn;
  delete require.cache[loggerPath];
});

test('logs a structured security event in production', () => {
  process.env.NODE_ENV = 'production';
  const warnings = [];
  console.warn = (...args) => warnings.push(args);

  const { logSecurityEvent } = require(loggerPath);

  logSecurityEvent({
    event: 'AUTHENTICATION_FAILURE',
    ip: '203.0.113.10',
    method: 'POST',
    route: '/api/login',
    details: { reason: 'invalid credentials' },
  });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], '[SECURITY]');
  const { timestamp, ...logEntry } = JSON.parse(warnings[0][1]);
  assert.equal(Number.isNaN(Date.parse(timestamp)), false);
  assert.deepEqual(
    logEntry,
    {
      event: 'AUTHENTICATION_FAILURE',
      ip: '203.0.113.10',
      method: 'POST',
      route: '/api/login',
      details: { reason: 'invalid credentials' },
    },
  );
});

test('logs suspicious activity after three authentication failures from one IP', () => {
  process.env.NODE_ENV = 'production';
  const warnings = [];
  console.warn = (...args) => warnings.push(args);

  const { logSecurityEvent } = require(loggerPath);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    logSecurityEvent({
      event: 'AUTHENTICATION_FAILURE',
      ip: '203.0.113.20',
      method: 'POST',
      route: '/api/login',
    });
  }

  assert.equal(warnings.length, 4);
  const suspiciousEvent = JSON.parse(warnings[3][1]);
  assert.equal(warnings[3][0], '[SECURITY]');
  assert.equal(suspiciousEvent.event, 'SUSPICIOUS_ACTIVITY');
  assert.equal(suspiciousEvent.ip, '203.0.113.20');
  assert.deepEqual(
    suspiciousEvent.details,
    ['3 AUTHENTICATION_FAILURE events within 5 minutes'],
  );
});
