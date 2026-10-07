const test = require('node:test');
const assert = require('node:assert/strict');
const { ForecastClient } = require('../src/comparison/services/forecast.client');

const input = {
    productId: '11111111-1111-4111-8111-111111111111',
    retailerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    currentPrice: '3.49',
    history: [{ price: '3.80' }, { price: '3.49' }],
    horizonDays: 14,
};

test('maps the current MVP forecast response contract', async () => {
    const client = new ForecastClient('http://forecast.test', {
        async post(url, body, config) {
            assert.equal(url, 'http://forecast.test/api/ml/price-prediction');
            assert.equal(body.days_ahead, 14);
            assert.ok(config.timeout > 0);
            return { data: {
                success: true,
                predicted_price: 3.2,
                confidence: 0.75,
                model_info: { model_type: 'moving_average_mvp' },
            } };
        },
    });

    assert.deepEqual(await client.forecast(input), {
        predictedPrice: '3.20',
        confidence: 0.75,
        modelVersion: 'moving_average_mvp',
        forecastAt: null,
    });
});

test('rejects malformed model responses', async () => {
    const client = new ForecastClient('http://forecast.test', {
        async post() { return { data: { success: true, confidence: 0.8 } }; },
    });
    await assert.rejects(client.forecast(input), /Malformed forecast response/);
});

test('rejects invalid confidence and mismatched retailer response mappings', async () => {
    const invalidConfidence = new ForecastClient('http://forecast.test', {
        async post() {
            return { data: {
                success: true,
                predicted_price: 3.2,
                confidence: 140,
                retailer_id: input.retailerId,
            } };
        },
    });
    await assert.rejects(invalidConfidence.forecast(input), /Malformed forecast response/);

    const mismatchedRetailer = new ForecastClient('http://forecast.test', {
        async post() {
            return { data: {
                success: true,
                predicted_price: 3.2,
                confidence: 0.75,
                retailer_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            } };
        },
    });
    await assert.rejects(mismatchedRetailer.forecast(input), /Malformed forecast response/);
});

test('rejects an invalid model version or forecast timestamp contract', async () => {
    const datedInput = {
        ...input,
        history: [
            { price: '3.80', observedAt: '2026-05-02T08:00:00.000Z' },
            { price: '3.49', observedAt: '2026-05-04T08:00:00.000Z' },
        ],
    };
    const invalidVersion = new ForecastClient('http://forecast.test', {
        async post() {
            return { data: { success: true, predicted_price: 3.2, confidence: 0.75 } };
        },
    });
    await assert.rejects(invalidVersion.forecast(datedInput), /Malformed forecast response/);

    const wrongDate = new ForecastClient('http://forecast.test', {
        async post() {
            return { data: {
                success: true,
                predicted_price: 3.2,
                confidence: 0.75,
                model_version: 'forecast-v1',
                forecast_at: '2026-06-20T08:00:00.000Z',
            } };
        },
    });
    await assert.rejects(wrongDate.forecast(datedInput), /Malformed forecast response/);
});

test('preserves timeout failures for section-level isolation', async () => {
    const timeout = Object.assign(new Error('timed out'), { code: 'ECONNABORTED' });
    const client = new ForecastClient('http://forecast.test', {
        async post() { throw timeout; },
    });
    await assert.rejects(client.forecast(input), (error) => error.code === 'ECONNABORTED');
});
