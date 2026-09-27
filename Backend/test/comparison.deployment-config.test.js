const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateComparisonDeployment } = require('../../.github/scripts/validate-comparison-deploy-config');

test('deployment defaults both comparison surfaces to disabled', () => {
  assert.deepEqual(validateComparisonDeployment({}), {
    backendEnabled: false,
    frontendEnabled: false,
  });
});

test('deployment rejects an enabled frontend with a disabled backend', () => {
  assert.throws(
    () => validateComparisonDeployment({
      BACKEND_COMPARISON_V2_ENABLED: 'false',
      FRONTEND_COMPARISON_V2_ENABLED: 'true',
    }),
    /frontend cannot be enabled before the backend/
  );
});

test('enabled backend requires Cloud SQL and the shared comparison database URL', () => {
  assert.throws(
    () => validateComparisonDeployment({ BACKEND_COMPARISON_V2_ENABLED: 'true' }),
    /CLOUD_SQL_INSTANCE_CONNECTION_NAME, COMPARISON_DATABASE_URL/
  );
});

test('deployment accepts a fully configured backend-first rollout', () => {
  assert.deepEqual(validateComparisonDeployment({
    BACKEND_COMPARISON_V2_ENABLED: 'true',
    FRONTEND_COMPARISON_V2_ENABLED: 'false',
    CLOUD_SQL_INSTANCE_CONNECTION_NAME: 'project:region:instance',
    COMPARISON_DATABASE_URL: 'postgresql://discount_mate_app:secret@/discount_mate',
  }), {
    backendEnabled: true,
    frontendEnabled: false,
  });
});

test('deployment maps one GitHub secret to both comparison database URLs', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '../../.github/workflows/app-dev-cloud-run-prep.yml'),
    'utf8'
  );

  assert.match(
    workflow,
    /RUNTIME_COMPARISON_DATABASE_URL: \$\{\{ secrets\.COMPARISON_DATABASE_URL \}\}/
  );
  assert.match(workflow, /- name: DE_DATABASE_URL\s+value: "\$\{RUNTIME_COMPARISON_DATABASE_URL\}"/);
  assert.match(workflow, /- name: APP_DATABASE_URL\s+value: "\$\{RUNTIME_COMPARISON_DATABASE_URL\}"/);
  assert.doesNotMatch(workflow, /DE_DATABASE_URL_SECRET_NAME|APP_DATABASE_URL_SECRET_NAME/);
});
