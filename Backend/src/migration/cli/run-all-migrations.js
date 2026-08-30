const { spawnSync } = require('child_process');
const path = require('path');
const BACKEND_ROOT = path.resolve(__dirname, '..', '..', '..');
const NPM_COMMAND = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const STEPS = [
  ['Create or upgrade app tables', 'db:migrate'],
  ['Create or upgrade the original Silver tables', 'db:silver:setup'],
  ['Copy users, subscriptions, and receipts', 'migrate:users'],
  ['Copy support requests and attachments', 'migrate:support-requests'],
  ['Copy the category/product catalogue', 'migrate:catalog'],
  ['Copy product-pricing history', 'migrate:product-pricing'],
  ['Copy shopping lists and comparison history', 'migrate:shopping-lists'],
  ['Copy alert segments and notifications', 'migrate:alerts-notifications'],
];

function usage() {
  return [
    'Complete MongoDB to PostgreSQL migration',
    '',
    'Usage:',
    '  npm run migrate:all',
    '',
    'The command runs schema setup and every independently rerunnable data phase',
    'in dependency order. Each data phase performs its own reconciliation, and the',
    'runner stops immediately if a step reports a failure or mismatch. Normal',
    'output is limited to step progress and migration counts.',
  ].join('\n');
}

function runStep(label, scriptName, stepNumber, scriptArgs = []) {
  console.log(`[${stepNumber}/${STEPS.length}] ${label}`);
  const quietStep = scriptName === 'db:migrate' || scriptName === 'db:silver:setup';

  const result = spawnSync(
    NPM_COMMAND,
    ['--silent', 'run', scriptName, ...(scriptArgs.length ? ['--', ...scriptArgs] : [])],
    {
      cwd: BACKEND_ROOT,
      env: process.env,
      stdio: quietStep ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      maxBuffer: 16 * 1024 * 1024,
      shell: false,
    },
  );

  if (result.error) {
    throw new Error(`Could not run ${scriptName}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr]
      .filter(Boolean)
      .map((output) => output.toString().trim())
      .filter(Boolean)
      .join('\n');
    const error = new Error(
      `${scriptName} exited with status ${result.status}${detail ? `\n${detail}` : ''}`,
    );
    error.exitCode = result.status;
    throw error;
  }
}

function main(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());

    return;
  }

  if (args.length) {
    throw new Error(`Unknown option: ${args[0]}\n\n${usage()}`);
  }

  STEPS.forEach(([label, scriptName], index) => {
    runStep(label, scriptName, index + 1);
  });
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`Complete migration failed: ${error.message}`);
    process.exitCode = error.exitCode || 1;
  }
}

module.exports = { STEPS, main, runStep, usage };
