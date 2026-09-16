const test = require('node:test');
const assert = require('node:assert/strict');
const { createComparisonRouter } = require('../src/comparison/routers/comparison.router');
const { comparisonErrorCode } = require('../src/comparison/controllers/comparison.controller');

test('comparison router exposes public product and authenticated grocery boundaries', async () => {
    const handler = () => (req, res) => res.json({ ok: true });
    const controller = {
        searchProducts: handler(),
        getRetailerCoverageDiagnostics: handler(),
        getProductComparison: handler(),
        createListRun: handler(),
        applySubstitution: handler(),
        dismissSubstitution: handler(),
        exportRun: handler(),
        startShopping: handler(),
        getShoppingSession: handler(),
        updateShoppingSessionItem: handler(),
        trackEvents: handler(),
    };
    const verify = (req, res, next) => {
        if (req.headers.authorization !== 'Bearer valid') return res.status(401).json({ message: 'No token' });
        req.user = { email: 'user@example.com' };
        return next();
    };
    const router = createComparisonRouter({ controller, verifyToken: verify });
    const routes = router.stack.filter((layer) => layer.route).map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
        handlers: layer.route.stack.length,
    }));

    assert.deepEqual(routes.map((route) => [route.methods[0], route.path]), [
        ['get', '/products'],
        ['get', '/diagnostics/retailer-coverage'],
        ['get', '/products/:deProductId'],
        ['post', '/lists/:listId/runs'],
        ['post', '/runs/:runId/substitutions/apply'],
        ['post', '/runs/:runId/substitutions/dismiss'],
        ['get', '/runs/:runId/export.csv'],
        ['post', '/runs/:runId/start-shopping'],
        ['get', '/shopping-sessions/:sessionId'],
        ['patch', '/shopping-sessions/:sessionId/items/:itemId'],
        ['post', '/events'],
    ]);
    assert.equal(routes.find((route) => route.path === '/products/:deProductId').handlers, 1);
    assert.equal(routes.find((route) => route.path === '/diagnostics/retailer-coverage').handlers, 2);
    assert.equal(routes.find((route) => route.path === '/lists/:listId/runs').handlers, 2);
});

test('comparison failures expose stable safe error codes', () => {
    assert.equal(comparisonErrorCode({ source: 'de' }, 503), 'de_unavailable');
    assert.equal(comparisonErrorCode({ source: 'app' }, 503), 'app_database_unavailable');
    assert.equal(comparisonErrorCode({ code: 'no_mapped_items' }, 422), 'no_mapped_items');
    assert.equal(comparisonErrorCode({}, 400), 'validation_failed');
    assert.equal(comparisonErrorCode({}, 500), 'comparison_unavailable');
});
