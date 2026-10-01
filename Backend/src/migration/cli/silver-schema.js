const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const ETL_ROOT = path.join(REPOSITORY_ROOT, 'DE', 'etl-pipeline');

function usage() {
  return [
    'Silver schema helper',
    '',
    'Usage:',
    '  node src/migration/cli/silver-schema.js setup',
    '  node src/migration/cli/silver-schema.js status',
    '',
    'setup   Start/reuse DE PostgreSQL and apply all Silver Alembic migrations.',
    'status  Show the Docker service and current/head Alembic revisions.',
  ].join('\n');
}

function run(command, args, options = {}) {
  const quiet = Boolean(options.quiet);

  const result = spawnSync(command, args, {
    cwd: options.cwd || ETL_ROOT,
    env: process.env,
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
  });

  if (result.error) {
    throw new Error(`Could not run ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr]
      .filter(Boolean)
      .map((output) => output.toString().trim())
      .filter(Boolean)
      .join('\n');
    throw new Error(
      `${command} exited with status ${result.status}${detail ? `\n${detail}` : ''}`,
    );
  }
}

function ensureEtlEnvironment() {
  const environmentPath = path.join(ETL_ROOT, '.env');

  if (fs.existsSync(environmentPath)) {
    return;
  }

  const examplePath = path.join(ETL_ROOT, '.env.example');
  fs.copyFileSync(examplePath, environmentPath, fs.constants.COPYFILE_EXCL);
}

function resolveAlembicCommand() {
  const candidates = process.platform === 'win32'
    ? [path.join(ETL_ROOT, '.venv', 'Scripts', 'alembic.exe')]
    : [path.join(ETL_ROOT, '.venv', 'bin', 'alembic')];

  const executable = candidates.find((candidate) => fs.existsSync(candidate));

  if (executable) {
    return { command: executable, prefixArgs: [] };
  }

  return { command: 'uv', prefixArgs: ['run', 'alembic'] };
}

function runAlembic(args) {
  const { command, prefixArgs } = resolveAlembicCommand();
  run(command, [...prefixArgs, ...args]);
}

function showStatus() {
  run('docker', ['compose', 'ps', 'postgres']);
  runAlembic(['current']);
  runAlembic(['heads']);
}

function setup() {
  ensureEtlEnvironment();
  console.log('[1/3] PostgreSQL');
  run('docker', ['compose', 'up', '-d', 'postgres'], { quiet: true });
  console.log('[2/3] readiness');
  run('docker', ['compose', 'exec', '-T', 'postgres', 'pg_isready'], { quiet: true });
  console.log('[3/3] Silver schema');
  const { command, prefixArgs } = resolveAlembicCommand();
  run(command, [...prefixArgs, 'upgrade', 'head'], { quiet: true });
}

function main(args) {
  const action = args[0];

  if (action === '--help' || action === '-h') {
    console.log(usage());

    return;
  }

  if (action === 'setup' && args.length === 1) {
    setup();

    return;
  }

  if (action === 'status' && args.length === 1) {
    ensureEtlEnvironment();
    showStatus();

    return;
  }

  throw new Error(`Unknown Silver schema action.\n\n${usage()}`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`Silver schema helper failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  ensureEtlEnvironment,
  main,
  resolveAlembicCommand,
  usage,
};
