const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCreateDatabaseSql,
  getDatabaseName,
  isLocalDatabaseUrl,
} = require('../scripts/ensure-app-database');

test('local App database setup extracts and safely quotes the configured database name', () => {
  const url = 'postgresql://postgres:secret@127.0.0.1:5433/discountmate_app';

  assert.equal(getDatabaseName(url), 'discountmate_app');
  assert.equal(isLocalDatabaseUrl(url), true);
  assert.equal(buildCreateDatabaseSql('discountmate_app'), 'CREATE DATABASE "discountmate_app"');
  assert.equal(buildCreateDatabaseSql('student"app'), 'CREATE DATABASE "student""app"');
});

test('local App database setup refuses an empty database name and recognises remote hosts', () => {
  assert.throws(() => getDatabaseName('postgresql://postgres:secret@127.0.0.1:5433/'), /database name/i);
  assert.equal(isLocalDatabaseUrl('postgresql://postgres:secret@db.example.test/app'), false);
});
