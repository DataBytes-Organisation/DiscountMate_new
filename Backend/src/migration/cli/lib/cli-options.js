function readValue(args, index, name) {
  const value = args[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }

  return value;
}

const SUPPORTED_PHASES = new Set([
  'users',
  'shopping-lists',
  'alerts-notifications',
  'support-requests',
  'catalog',
  'product-pricing',
]);

function parseCliOptions(args) {
  const options = {
    phase: null,
    reconcileOnly: false,
    failFast: false,
    batchSize: 100,
    afterId: null,
    sourceDb: process.env.MONGO_DB_NAME || 'DiscountMate_DB',
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    switch (argument) {
      case '--phase':
        options.phase = readValue(args, index, '--phase');
        index += 1;
        break;
      case '--batch-size':
        options.batchSize = Number(readValue(args, index, '--batch-size'));
        index += 1;
        break;
      case '--after-id':
        options.afterId = readValue(args, index, '--after-id');
        index += 1;
        break;
      case '--source-db':
        options.sourceDb = readValue(args, index, '--source-db');
        index += 1;
        break;
      case '--reconcile-only':
        options.reconcileOnly = true;
        break;
      case '--fail-fast':
        options.failFast = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${argument}`);
    }
  }

  if (!options.help && !SUPPORTED_PHASES.has(options.phase)) {
    throw new Error(
      '--phase must be one of: users, shopping-lists, alerts-notifications, support-requests, catalog, product-pricing',
    );
  }

  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 1000) {
    throw new Error('--batch-size must be an integer between 1 and 1000');
  }

  return options;
}

function usage() {
  return [
    'MongoDB to PostgreSQL migration CLI',
    '',
    'Usage:',
    '  npm run migrate:users',
    '  npm run reconcile:users',
    '  npm run migrate:shopping-lists',
    '  npm run reconcile:shopping-lists',
    '  npm run migrate:alerts-notifications',
    '  npm run reconcile:alerts-notifications',
    '  npm run migrate:support-requests',
    '  npm run reconcile:support-requests',
    '  npm run migrate:catalog',
    '  npm run reconcile:catalog',
    '  npm run migrate:product-pricing',
    '  npm run reconcile:product-pricing',
    '',
    'Options:',
    '  --phase <name>         users, shopping-lists, alerts-notifications, support-requests, catalog, or product-pricing',
    '  --batch-size <1-1000>  Mongo cursor batch size (default: 100)',
    '  --after-id <ObjectId>  Resume scanning after a Mongo ObjectId',
    '  --source-db <name>     Mongo database name',
    '  --reconcile-only       Run reconciliation without copying documents',
    '  --fail-fast            Stop after the first document failure',
  ].join('\n');
}

module.exports = { parseCliOptions, usage };
