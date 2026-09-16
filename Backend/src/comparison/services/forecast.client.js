const axios = require('axios');

class ForecastClient {
  constructor(baseUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001', http = axios) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.http = http;
  }

  async forecast(input) {
    const response = await this.http.post(`${this.baseUrl}/api/ml/price-prediction`, {
      product_id: input.productId,
      retailer_id: input.retailerId,
      days_ahead: input.horizonDays,
      current_price: Number(input.currentPrice),
      price_history: input.history.map((point) => Number(point.price)),
    }, { timeout: Number(process.env.FORECAST_TIMEOUT_MS || 5000) });

    const payload = response.data?.data || response.data;

    const predictedPrice = Number(payload?.predicted_price);
    const confidence = normalizeConfidence(payload?.confidence);
    const responseRetailerId = payload?.retailer_id == null ? null : String(payload.retailer_id);
    const forecastAt = payload?.forecast_at == null ? null : new Date(payload.forecast_at);
    const modelVersion = payload?.model_info?.model_type || payload?.model_version;
    const latestObservedAt = latestValidObservation(input.history);
    const expectedForecastAt = latestObservedAt
      ? addUtcDays(latestObservedAt, Number(input.horizonDays))
      : null;

    if (
      response.data?.success === false ||
      !Number.isFinite(predictedPrice) || predictedPrice <= 0 ||
      confidence == null ||
      typeof modelVersion !== 'string' || !modelVersion.trim() ||
      (responseRetailerId && responseRetailerId !== String(input.retailerId)) ||
      (forecastAt && Number.isNaN(forecastAt.getTime())) ||
      (forecastAt && expectedForecastAt && utcDay(forecastAt) !== utcDay(expectedForecastAt))
    ) {
      throw new Error('Malformed forecast response');
    }

    return {
      predictedPrice: predictedPrice.toFixed(2),
      confidence,
      modelVersion: modelVersion.trim(),
      forecastAt: forecastAt ? forecastAt.toISOString() : null,
    };
  }
}

function latestValidObservation(history) {
  return (history || [])
    .map((point) => new Date(point.observedAt))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0] || null;
}

function addUtcDays(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function utcDay(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) return null;
  const normalized = numeric > 1 ? numeric / 100 : numeric;
  return normalized >= 0 && normalized <= 1 ? normalized : null;
}

module.exports = { ForecastClient, normalizeConfidence };
