const express = require('express');
const {
  getPostgresCatalogueCapability,
  getPostgresCatalogueDataSource,
  getPostgresCatalogueReadModel,
} = require('../database/catalogue-data-source');

const {
  PostgresCatalogueRepository,
} = require('../repositories/postgres-catalogue.repository');

const {
  PostgresCatalogueError,
  PostgresCatalogueService,
} = require('../services/postgres-catalogue.service');

function getPostgresCatalogueStatus(req, res) {
  const state = getPostgresCatalogueCapability();
  const enabled = state.requested && state.configured;

  return res.json({
    enabled,
    available: enabled && state.available,
  });
}

function requirePostgresCatalogue(req, res, next) {
  const state = getPostgresCatalogueCapability();

  if (!state.requested || !state.configured) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found.',
    });
  }

  if (!state.available) {
    return res.status(503).json({
      error: {
        code: 'POSTGRES_CATALOG_UNAVAILABLE',
        message: 'The PostgreSQL catalogue is temporarily unavailable.',
      },
    });
  }

  return next();
}

function sendCatalogueError(error, res) {
  if (error instanceof PostgresCatalogueError) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
  }

  console.error('PostgreSQL catalogue request failed:', error.message);
  const timedOut =
    error.code === '57014' ||
    /timeout|canceling statement/i.test(error.message || '');

  return res.status(timedOut ? 504 : 503).json({
    error: {
      code: timedOut
        ? 'POSTGRES_CATALOG_TIMEOUT'
        : 'POSTGRES_CATALOG_UNAVAILABLE',
      message: timedOut
        ? 'The PostgreSQL catalogue request timed out.'
        : 'The PostgreSQL catalogue is temporarily unavailable.',
    },
  });
}

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      return res.json(await handler(req));
    } catch (error) {
      return sendCatalogueError(error, res);
    }
  };
}

function createPostgresCatalogueRouter({ service } = {}) {
  const router = express.Router();
  const resolvedService =
    service ||
    new PostgresCatalogueService(
      new PostgresCatalogueRepository(
        getPostgresCatalogueDataSource,
        getPostgresCatalogueReadModel,
      ),
    );

  router.get('/status', getPostgresCatalogueStatus);
  router.use(requirePostgresCatalogue);
  router.get(
    '/categories',
    asyncRoute(() => resolvedService.getCategories()),
  );
  router.get(
    '/products',
    asyncRoute((req) => resolvedService.getProducts(req.query)),
  );
  router.get(
    '/search',
    asyncRoute((req) =>
      resolvedService.getProducts(req.query, {
        search: req.query.search || req.query.q,
      })),
  );
  router.get(
    '/specials',
    asyncRoute((req) =>
      resolvedService.getProducts(req.query, { specialsOnly: true })),
  );
  router.get(
    '/products/:id',
    asyncRoute((req) => resolvedService.getProduct(req.params.id)),
  );

  return router;
}

module.exports = {
  createPostgresCatalogueRouter,
  getPostgresCatalogueStatus,
  requirePostgresCatalogue,
  sendCatalogueError,
};
