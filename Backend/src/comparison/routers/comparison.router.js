const express = require('express');
const jwt = require('jsonwebtoken');
const verifyToken = require('../../middleware/auth.middleware');
const controller = require('../controllers/comparison.controller');

function createComparisonRouter(options = {}) {
  const handlers = options.controller || controller;
  const requireAuth = options.verifyToken || verifyToken;
  const optional = options.optionalAuth || optionalAuth;
  const router = express.Router();

  router.use((req, res, next) => {
    const enabled = process.env.COMPARISON_V2_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
    if (!enabled) return res.status(404).json({ message: 'Comparison V2 is disabled' });

    return next();
  });

  router.get('/products', handlers.searchProducts);
  router.get('/diagnostics/retailer-coverage', requireAuth, handlers.getRetailerCoverageDiagnostics);
  router.get('/products/:deProductId', handlers.getProductComparison);
  router.post('/lists/:listId/runs', requireAuth, handlers.createListRun);
  router.post('/runs/:runId/substitutions/apply', requireAuth, handlers.applySubstitution);
  router.post('/runs/:runId/substitutions/dismiss', requireAuth, handlers.dismissSubstitution);
  router.get('/runs/:runId/export.csv', requireAuth, handlers.exportRun);
  router.post('/runs/:runId/start-shopping', requireAuth, handlers.startShopping);
  router.get('/shopping-sessions/:sessionId', requireAuth, handlers.getShoppingSession);
  router.patch('/shopping-sessions/:sessionId/items/:itemId', requireAuth, handlers.updateShoppingSessionItem);
  router.post('/events', optional, handlers.trackEvents);

  return router;
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    // Analytics must remain best-effort and must not block anonymous comparison usage.
  }

  return next();
}

module.exports = createComparisonRouter();
module.exports.createComparisonRouter = createComparisonRouter;
