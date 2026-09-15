const { spawnSync } = require('child_process');
const { randomUUID } = require('crypto');
const path = require('path');
const { printOrchestrationSummary } = require('./lib/orchestration-summary');
const BACKEND_ROOT = path.resolve(__dirname, '..', '..', '..');
const NPM_COMMAND = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const STEPS = [
  ['Users, subscriptions, and receipts', 'reconcile:users'],
  ['Support requests and attachments', 'reconcile:support-requests'],
  ['Category/product catalogue', 'reconcile:catalog'],
  ['Product-pricing history', 'reconcile:product-pricing'],
  ['Shopping lists and comparison history', 'reconcile:shopping-lists'],
  ['Alert segments and notifications', 'reconcile:alerts-notifications'],
];

function usage() {
  return [
    'Complete MongoDB to PostgreSQL reconciliation',
    '',
    'Usage:',
    '  npm run reconcile:all',
    '',
    'The command runs every phase reconciliation in dependency order without',
    'copying application data. It continues after mismatches so every phase is',
    'checked, prints one aggregate total, then exits 1 for a technical failure or',
    '2 for mismatches only.',
  ].join('\n');
}

function runStep(label, scriptName, stepNumber, orchestrationId) {
  console.log(`[${stepNumber}/${STEPS.length}] ${label}`);

  const result = spawnSync(
    NPM_COMMAND,
    ['--silent', 'run', scriptName],
    {
      cwd: BACKEND_ROOT,
      env: {
        ...process.env,
        MIGRATION_ORCHESTRATION_ID: orchestrationId,
      },
      stdio: 'inherit',
      shell: false,
    },
  );

  if (result.error) {
    console.error(`${scriptName} could not run: ${result.error.message}`);

    return { label, scriptName, outcome: 'failed', exitCode: 1 };
  }

  if (result.status === 0) {
    return { label, scriptName, outcome: 'passed', exitCode: 0 };
  }

  if (result.status === 2) {
    return { label, scriptName, outcome: 'mismatch', exitCode: 2 };
  }

  return { label, scriptName, outcome: 'failed', exitCode: result.status || 1 };
}

function overallExitCode(results) {
  if (results.some((result) => result.outcome === 'failed')) return 1;
  if (results.some((result) => result.outcome === 'mismatch')) return 2;

  return 0;
}

async function main(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());

    return 0;
  }

  if (args.length) {
    throw new Error(`Unknown option: ${args[0]}\n\n${usage()}`);
  }

  const orchestrationId = randomUUID();
  const results = STEPS.map(([label, scriptName], index) => (
    runStep(label, scriptName, index + 1, orchestrationId)
  ));

  await printOrchestrationSummary(orchestrationId, 'reconciliation').catch((error) => {
    console.error(`Reconciliation totals unavailable: ${error.message}`);
  });

  return overallExitCode(results);
}

if (require.main === module) {
  main(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  }).catch((error) => {
    console.error(`Complete reconciliation failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  STEPS,
  main,
  overallExitCode,
  runStep,
  usage,
};
