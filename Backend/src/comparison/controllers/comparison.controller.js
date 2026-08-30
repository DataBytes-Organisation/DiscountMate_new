const { getPostgresPools } = require('../../config/postgres');
const { AppComparisonRepository } = require('../repositories/app-comparison.repository');
const { DeComparisonRepository, isUuid } = require('../repositories/de-comparison.repository');
const { MongoListRepository } = require('../repositories/mongo-list.repository');
const { createComparisonService } = require('../services/comparison.service');
const { ForecastClient } = require('../services/forecast.client');
let service;

function getService() {
  if (!service) {
    const pools = getPostgresPools();
    service = createComparisonService({
      deRepository: new DeComparisonRepository(pools.de),
      appRepository: new AppComparisonRepository(pools.app),
      listRepository: new MongoListRepository(),
      forecastClient: new ForecastClient(),
    });
  }

  return service;
}

async function searchProducts(req, res) {
  return handle(res, async () => {
    const products = await getService().searchProducts(req.query.search, req.query.limit);

    return res.json({ data: products });
  });
}

async function getRetailerCoverageDiagnostics(req, res) {
  return handle(res, async () => {
    const data = await getService().getRetailerCoverageDiagnostics();

    return res.json({ data });
  });
}

async function getProductComparison(req, res) {
  return handle(res, async () => {
    if (!isUuid(req.params.deProductId)) return res.status(400).json({ message: 'Invalid comparison product id', code: 'validation_failed' });
    const retailerIds = String(req.query.retailers || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (retailerIds.some((value) => !isUuid(value))) {
      return res.status(400).json({ message: 'Retailer filters must be UUIDs', code: 'validation_failed' });
    }

    const data = await getService().getProductComparison(req.params.deProductId, {
      range: req.query.range || '3m',
      retailerIds,
      includeSimilar: req.query['include-similar'] !== 'false',
    });

    return res.json({ data });
  });
}

async function createListRun(req, res) {
  return handle(res, async () => {
    const data = await getService().createListRun(req.params.listId, userRef(req), req.body);

    return res.status(201).json({ data });
  });
}

async function applySubstitution(req, res) {
  return handle(res, async () => {
    const data = await getService().applySubstitution(req.params.runId, userRef(req), req.body);

    return res.status(201).json({ data });
  });
}

async function dismissSubstitution(req, res) {
  return handle(res, async () => {
    const data = await getService().dismissSubstitution(req.params.runId, userRef(req), req.body);

    return res.json({ data });
  });
}

async function exportRun(req, res) {
  return handle(res, async () => {
    const csv = await getService().exportRun(req.params.runId, req.query.planId, userRef(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="discountmate-${req.params.runId}.csv"`);

    return res.send(`\uFEFF${csv}`);
  });
}

async function startShopping(req, res) {
  return handle(res, async () => {
    const data = await getService().startShopping(
      req.params.runId,
      req.body?.planId,
      userRef(req),
    );

    return res.json({ data });
  });
}

async function getShoppingSession(req, res) {
  return handle(res, async () => {
    const data = await getService().getShoppingSession(req.params.sessionId, userRef(req));

    return res.json({ data });
  });
}

async function updateShoppingSessionItem(req, res) {
  return handle(res, async () => {
    const data = await getService().updateShoppingSessionItem(
      req.params.sessionId,
      req.params.itemId,
      userRef(req),
      req.body?.checked,
    );

    return res.json({ data });
  });
}

async function trackEvents(req, res) {
  return handle(res, async () => {
    const data = await getService().trackEvents(req.body?.events, {
      userRef: req.user?.email || null,
    });

    return res.status(202).json({ data });
  });
}

function userRef(req) {
  return req.user?.id || req.user?.sub || req.user?.email;
}

async function handle(res, work) {
  try {
    return await work();
  } catch (error) {
    const status = Number(error.status) || (error.code === '22P02' ? 400 : 500);
    if (status >= 500) console.error('Comparison request failed:', error);

    return res.status(status).json({
      message: status >= 500 ? 'Comparison data is temporarily unavailable.' : error.message,
      code: comparisonErrorCode(error, status),
    });
  }
}

const PUBLIC_ERROR_CODES = new Set([
  'authentication_required',
  'list_not_found',
  'no_mapped_items',
  'de_unavailable',
  'app_database_unavailable',
  'validation_failed',
  'comparison_unavailable',
]);

function comparisonErrorCode(error, status) {
  if (PUBLIC_ERROR_CODES.has(error?.code)) return error.code;
  if (error?.source === 'de') return 'de_unavailable';
  if (error?.source === 'app') return 'app_database_unavailable';
  if (Number(status) === 401 || Number(status) === 403) return 'authentication_required';
  if (Number(status) >= 400 && Number(status) < 500) return 'validation_failed';
  return 'comparison_unavailable';
}

module.exports = {
  applySubstitution,
  createListRun,
  dismissSubstitution,
  exportRun,
  getProductComparison,
  getRetailerCoverageDiagnostics,
  getShoppingSession,
  searchProducts,
  startShopping,
  trackEvents,
  updateShoppingSessionItem,
  comparisonErrorCode,
};
