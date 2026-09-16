function mongoRequiredAtStartup(env = process.env) {
  const configured = String(env.MONGO_REQUIRED_AT_STARTUP || '').trim().toLowerCase();
  if (configured === 'true') return true;
  if (configured === 'false') return false;
  return env.NODE_ENV === 'production';
}

async function initializeMongoDependency({
  initialize,
  env = process.env,
  logger = console,
}) {
  try {
    await initialize();
    return { available: true, errorCode: null };
  } catch (error) {
    if (mongoRequiredAtStartup(env)) throw error;

    const errorCode = error?.code || error?.cause?.code || 'mongo_unavailable';
    logger.warn(
      `MongoDB is unavailable (${errorCode}); starting in degraded mode. `
      + 'Mongo-backed authentication, saved lists, and catalogue routes will be unavailable.',
    );
    return { available: false, errorCode };
  }
}

async function initializeReverseImageSearchDependency({
  initialize,
  env = process.env,
  logger = console,
}) {
  try {
    await initialize();
    return { available: true, errorCode: null };
  } catch (error) {
    if (String(env.REVERSE_IMAGE_SEARCH_REQUIRED_AT_STARTUP || '').toLowerCase() === 'true') {
      throw error;
    }

    const errorCode = error?.code || error?.cause?.code || 'reverse_image_search_unavailable';
    logger.warn(
      `Reverse Image Search is unavailable (${errorCode}); starting without scan/image-search support.`,
    );
    return { available: false, errorCode };
  }
}

module.exports = {
  initializeMongoDependency,
  initializeReverseImageSearchDependency,
  mongoRequiredAtStartup,
};
