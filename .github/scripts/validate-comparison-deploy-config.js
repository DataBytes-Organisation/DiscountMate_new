function enabled(value) {
  return value === 'true';
}

function validateBoolean(name, value) {
  if (value && value !== 'true' && value !== 'false') {
    throw new Error(`${name} must be either "true" or "false".`);
  }
}

function validateComparisonDeployment(env = process.env) {
  validateBoolean('BACKEND_COMPARISON_V2_ENABLED', env.BACKEND_COMPARISON_V2_ENABLED);
  validateBoolean('FRONTEND_COMPARISON_V2_ENABLED', env.FRONTEND_COMPARISON_V2_ENABLED);

  const backendEnabled = enabled(env.BACKEND_COMPARISON_V2_ENABLED);
  const frontendEnabled = enabled(env.FRONTEND_COMPARISON_V2_ENABLED);

  if (frontendEnabled && !backendEnabled) {
    throw new Error('Comparison frontend cannot be enabled before the backend.');
  }

  if (backendEnabled) {
    const required = [
      'CLOUD_SQL_INSTANCE_CONNECTION_NAME',
      'COMPARISON_DATABASE_URL',
    ];
    const missing = required.filter((name) => !env[name]);
    if (missing.length) {
      throw new Error(`Enabled comparison backend is missing: ${missing.join(', ')}`);
    }
  }

  return { backendEnabled, frontendEnabled };
}

if (require.main === module) {
  try {
    const result = validateComparisonDeployment();
    console.log(
      `Comparison deployment configuration is valid (backend=${result.backendEnabled}, frontend=${result.frontendEnabled}).`
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateComparisonDeployment };
