const { randomUUID } = require('node:crypto');
const {
  compareExactOffers,
  confidenceLabel,
  evaluateAdvice,
  normalizePack,
  optimizeBasket,
  toCents,
} = require('../domain/comparison');

const { buildPlanCsv } = require('../domain/csv');
const { validateTrackingEvents } = require('../domain/events');
const { ProductLinkRetailerAdapter } = require('./retailer-cart.adapters');
const CALCULATION_POLICY_VERSION = 'comparison-v2.3';
const ALLOWED_RETAILER_HOSTS = new Set([
  'aldi.com.au',
  'www.aldi.com.au',
  'coles.com.au',
  'www.coles.com.au',
  'iga.com.au',
  'www.iga.com.au',
  'woolworths.com.au',
  'www.woolworths.com.au',
]);

function createComparisonService({
  deRepository,
  appRepository,
  listRepository,
  forecastClient,
  clock = () => new Date(),
  uuid = randomUUID,
  productLinkAdapter = new ProductLinkRetailerAdapter(allowlistedRetailerUrl),
}) {
  async function getProductComparison(productId, options = {}) {
    return deRepository.withReadOnlySnapshot(async (repository) => {
      const product = await repository.getProduct(productId);
      if (!product) throw serviceError(404, 'Product is not eligible for comparison');
      const comparisonProductId = product.id;
      const [offers, history, alternatives, dataWatermark, retailers, productRetailerIds] = await Promise.all([
        repository.getLatestOffers(comparisonProductId, options.retailerIds),
        repository.getPriceHistory(comparisonProductId, options.range || '3m', options.retailerIds),
        options.includeSimilar ? repository.getAlternatives(comparisonProductId) : Promise.resolve([]),
        repository.getWatermark(),
        typeof repository.getRetailers === 'function'
          ? repository.getRetailers(options.retailerIds)
          : Promise.resolve([]),
        typeof repository.getProductRetailerIds === 'function'
          ? repository.getProductRetailerIds(comparisonProductId)
          : Promise.resolve(null),
      ]);
      const exact = compareExactOffers(offers);
      const aggregatedHistory = aggregateHistory(history);
      const warnings = [];

      if (exact.excludedOffers.some((offer) => offer.reason === 'incompatible_pack')) {
        warnings.push(warning('offers', 'incompatible_units', 'Offers with incompatible quantities or units were excluded.'));
      }

      const offeredRetailerIds = new Set(exact.offers.map((offer) => String(offer.retailerId)));
      const memberRetailerIds = productRetailerIds
        ? new Set(productRetailerIds.map(String))
        : null;
      const incompatibleRetailerIds = new Set(
        exact.excludedOffers
          .filter((offer) => offer.reason === 'incompatible_pack')
          .map((offer) => String(offer.retailerId)),
      );
      const unavailableRetailers = retailers
        .filter((retailer) => !offeredRetailerIds.has(String(retailer.retailerId)))
        .map((retailer) => {
          const retailerId = String(retailer.retailerId);
          let reason = retailer.dataAvailable === false
            ? 'retailer_data_unavailable'
            : 'no_current_offer';
          if (retailer.dataAvailable !== false) {
            if (incompatibleRetailerIds.has(retailerId)) reason = 'incompatible_pack';
            else if (memberRetailerIds && !memberRetailerIds.has(retailerId)) reason = 'no_exact_product_match';
          }

          return { ...retailer, reason };
        });

      const forecastSettled = await Promise.allSettled(exact.offers.map(async (offer) => {
        const retailerHistory = aggregatedHistory.filter((point) => point.retailerId === offer.retailerId);
        const distinctDays = new Set(retailerHistory.map((point) => utcDay(point.observedAt))).size;
        const latestObservation = retailerHistory.at(-1) || {
          price: offer.price.amount,
          observedAt: offer.observedAt,
        };
        const basedOnObservedAt = new Date(latestObservation.observedAt).toISOString();
        const forecastAt = addUtcDays(basedOnObservedAt, 14);

        if (distinctDays < 3) {
          return baselineForecast(offer, latestObservation, 'insufficient_history');
        }

        const result = await forecastClient.forecast({
          productId: comparisonProductId,
          retailerId: offer.retailerId,
          retailerName: offer.retailerName,
          currentPrice: offer.price.amount,
          history: retailerHistory,
          horizonDays: 14,
        });
        if (!result) return null;
        const current = Number(offer.price.amount);
        const predicted = Number(result.predictedPrice);
        const predictedChangePercent = current > 0
          ? ((predicted - current) / current) * 100
          : null;

        return {
          retailerId: offer.retailerId,
          retailerName: offer.retailerName,
          horizonDays: 14,
          predictedPrice: { amount: Number(predicted).toFixed(2), currency: 'AUD' },
          predictedChangePercent,
          forecastKind: 'model',
          baselineReason: null,
          forecastAt,
          basedOnObservedAt,
          confidence: result.confidence,
          confidenceLabel: confidenceLabel(result.confidence),
          modelVersion: result.modelVersion || null,
        };
      }));

      const forecasts = forecastSettled
        .map((entry, index) => {
          if (entry.status === 'fulfilled' && entry.value) return entry.value;
          const offer = exact.offers[index];
          const retailerHistory = aggregatedHistory.filter((point) => point.retailerId === offer.retailerId);
          const latestObservation = retailerHistory.at(-1) || {
            price: offer.price.amount,
            observedAt: offer.observedAt,
          };
          return baselineForecast(offer, latestObservation, 'model_unavailable');
        });

      if (forecastSettled.some((entry) => entry.status === 'rejected' || !entry.value)) {
        warnings.push(warning('forecast', 'forecast_partial', 'Forecasts are temporarily unavailable for one or more retailers.'));
      }

      const cheapestRaw = exact.cheapest
        ? offers.find((offer) => offer.retailerId === exact.cheapest.retailerId)
        : null;

      const cheapestHistory = cheapestRaw
        ? aggregatedHistory.filter((point) => point.retailerId === cheapestRaw.retailerId)
        : [];

      const historicPrices = cheapestHistory.map((point) => Number(point.price)).filter(Number.isFinite);
      const isNinetyDayLow = cheapestRaw && historicPrices.length >= 2
        ? Number(cheapestRaw.price) <= Math.min(...historicPrices)
        : false;

      const forecast = forecasts.find((item) => (
        item.retailerId === cheapestRaw?.retailerId && item.forecastKind === 'model'
      ));
      const advice = evaluateAdvice({
        specialText: cheapestRaw?.specialText,
        isNinetyDayLow,
        isBestObservedDiscount: Boolean(cheapestRaw?.isOnSpecial && isNinetyDayLow),
        predictedChangePercent: forecast?.predictedChangePercent,
        confidence: forecast?.confidence,
        forecastKind: forecast?.forecastKind,
        offers: exact.offers,
      });

      return {
        comparisonProductId,
        product,
        offers: exact.offers,
        unavailableRetailers,
        cheapest: exact.cheapest,
        excludedOffers: exact.excludedOffers,
        history: aggregatedHistory.map((point) => ({
          ...point,
          price: { amount: Number(point.price).toFixed(2), currency: 'AUD' },
        })),
        historyObservationDays: new Set(aggregatedHistory.map((point) => utcDay(point.observedAt))).size,
        forecasts,
        advice,
        alternatives,
        dataWatermark,
        calculationPolicyVersion: CALCULATION_POLICY_VERSION,
        warnings,
      };
    });
  }

  async function searchProducts(search, limit) {
    return deRepository.withReadOnlySnapshot((repository) => repository.searchProducts(search, limit));
  }

  async function getRetailerCoverageDiagnostics() {
    return deRepository.withReadOnlySnapshot(
      (repository) => repository.getRetailerCoverageDiagnostics(),
    );
  }

  async function createListRun(listId, userId, input) {
    validateRunInput(input);
    const list = await listRepository.getList(listId, userId);
    if (!list) throw serviceError(404, 'Saved list not found', 'list_not_found');

    try {
      return await deRepository.withReadOnlySnapshot(async (repository) => {
        const migrationResolved = typeof appRepository.resolveLegacyProductReferences === 'function'
          ? await appRepository.resolveLegacyProductReferences(list.items || [])
          : list.items || [];

        const resolutions = await repository.resolveListItems(migrationResolved);
        const resolvedItems = resolutions.filter((item) => item.productId);

        if (!resolvedItems.length) {
          throw serviceError(
            422,
            'No saved-list products could be mapped to the comparison catalogue.',
            'no_mapped_items',
          );
        }

        if (typeof appRepository.persistProductMappings === 'function') {
          await appRepository.persistProductMappings(resolutions
            .filter((item) => item.productId && item.legacyProductId && item.mappingMethod)
            .map((item) => ({
              sourceRef: String(item.legacyProductId),
              targetProductId: String(item.productId),
              mappingMethod: item.mappingMethod,
            })));
        }

        return buildAndPersistRun(repository, {
          listId,
          listName: list.name,
          userId,
          objective: input.objective,
          maxRetailers: input.maxRetailers,
          allowStoreBrandSubstitutions: Boolean(input.allowStoreBrandSubstitutions),
          items: resolvedItems,
          originalItems: list.items || [],
          resolutions,
        });
      });
    } catch (error) {
      const canFallback = error.source !== 'app' && Number(error.status || 500) >= 500 &&
                typeof appRepository.getLatestRunForList === 'function';

      const previous = canFallback
        ? await appRepository.getLatestRunForList(listId, userId)
        : null;
      if (!previous) throw error;

      return {
        ...previous,
        isStaleFallback: true,
        warnings: [
          warning('comparison', 'de_unavailable_stale_snapshot', 'Live Silver data is unavailable. Showing the latest saved comparison snapshot.'),
          ...(previous.warnings || []),
        ],
      };
    }
  }

  async function buildAndPersistRun(repository, input) {
    const now = clock();
    const productIds = input.items.map((item) => item.productId).filter(Boolean);
    const [offers, dataWatermark] = await Promise.all([
      repository.getOffersForProducts(productIds),
      repository.getWatermark(),
    ]);

    const optimized = optimizeBasket({
      items: input.items,
      offers,
      objective: input.objective,
      maxRetailers: input.maxRetailers,
    });

    const productById = new Map(input.items.map((item) => [String(item.productId), item]));
    const suggestionCandidates = input.allowStoreBrandSubstitutions
      ? await buildSuggestions(repository, input.items, offers)
      : [];

    const snapshot = {
      id: uuid(),
      parentRunId: input.parentRunId || null,
      listId: input.listId,
      listName: input.listName,
      userId: input.userId,
      status: 'completed',
      objective: input.objective,
      maxRetailers: input.maxRetailers,
      allowStoreBrandSubstitutions: Boolean(input.allowStoreBrandSubstitutions),
      calculationPolicyVersion: CALCULATION_POLICY_VERSION,
      dataWatermark,
      createdAt: now.toISOString(),
      items: input.items,
      itemResolutions: input.resolutions || input.items,
      retailerResults: optimized.retailerResults.map((result) => serializeRetailerResult(result, productById)),
      plans: optimized.plans.map((plan) => ({
        ...plan,
        id: uuid(),
        items: plan.items.map((item) => serializePlanItem(item, productById)),
      })),
      unavailableProductIds: optimized.unavailableProductIds,
      warnings: buildRunWarnings(input.originalItems || input.items, input.items, optimized),
      suggestions: suggestionCandidates.map((suggestion) => ({ id: uuid(), ...suggestion })),
    };
    await appRepository.persistRun(snapshot);

    return snapshot;
  }

  async function applySubstitution(runId, userId, input) {
    const source = await appRepository.getRun(runId, userId);
    if (!source) throw serviceError(404, 'Comparison run not found');

    if (!input?.originalProductId || !input?.replacementProductId) {
      throw serviceError(400, 'Both originalProductId and replacementProductId are required');
    }

    const originalIndex = source.items.findIndex(
      (item) => String(item.productId) === String(input.originalProductId),
    );
    if (originalIndex < 0) throw serviceError(400, 'Original product is not part of this run');

    return deRepository.withReadOnlySnapshot(async (repository) => {
      const replacementProduct = await repository.getProduct(input.replacementProductId);
      if (!replacementProduct) throw serviceError(404, 'Replacement product is unavailable');
      const items = structuredClone(source.items);
      items[originalIndex] = {
        ...items[originalIndex],
        productId: input.replacementProductId,
        name: replacementProduct.name,
        substitutionForProductId: input.originalProductId,
      };
      const snapshot = await buildAndPersistRun(repository, {
        parentRunId: source.id,
        listId: source.listId,
        listName: source.listName,
        userId,
        objective: source.objective,
        maxRetailers: source.maxRetailers,
        allowStoreBrandSubstitutions: source.allowStoreBrandSubstitutions,
        items,
      });
      await appRepository.recordSubstitutionDecision({
        id: uuid(),
        runId: source.id,
        replacementRunId: snapshot.id,
        userId,
        originalProductId: input.originalProductId,
        replacementProductId: input.replacementProductId,
        action: 'applied',
        createdAt: clock().toISOString(),
      });

      return snapshot;
    });
  }

  async function dismissSubstitution(runId, userId, input) {
    const source = await appRepository.getRun(runId, userId);
    if (!source) throw serviceError(404, 'Comparison run not found');

    if (!input?.originalProductId || !input?.replacementProductId) {
      throw serviceError(400, 'Both originalProductId and replacementProductId are required');
    }
    await appRepository.recordSubstitutionDecision({
      id: uuid(),
      runId: source.id,
      replacementRunId: null,
      userId,
      originalProductId: input.originalProductId,
      replacementProductId: input.replacementProductId,
      action: 'dismissed',
      createdAt: clock().toISOString(),
    });

    return { status: 'dismissed' };
  }

  async function exportRun(runId, planId, userId) {
    const run = await appRepository.getRun(runId, userId);
    if (!run) throw serviceError(404, 'Comparison run not found');
    const plan = run.plans.find((candidate) => candidate.id === planId);
    if (!plan) throw serviceError(404, 'Comparison plan not found');

    return buildPlanCsv(run, plan);
  }

  async function startShopping(runId, planId, userId) {
    const run = await appRepository.getRun(runId, userId);
    if (!run) throw serviceError(404, 'Comparison run not found');
    const plan = run.plans.find((candidate) => candidate.id === planId);
    if (!plan) throw serviceError(404, 'Comparison plan not found');

    const groups = productLinkAdapter.createGroups(plan.items || []);
    const retailers = groups.map(({ retailerName, items }) => ({
      retailerName,
      urls: Array.from(new Set(items.map((item) => item.productUrl).filter(Boolean))),
    })).filter((retailer) => retailer.urls.length > 0);

    const session = {
      id: uuid(),
      runId,
      planId,
      userId,
      status: 'active',
      createdAt: clock().toISOString(),
      groups,
    };

    if (typeof appRepository.createShoppingSession === 'function') {
      await appRepository.createShoppingSession(session);
    }

    await appRepository.markShoppingStarted(runId, planId, userId);

    return { runId, planId, sessionId: session.id, groups, retailers };
  }

  async function trackEvents(events, context = {}) {
    const validated = validateTrackingEvents(events).map((event) => ({ ...event, ...context }));
    await appRepository.recordEvents(validated);

    return { accepted: validated.length };
  }

  async function getShoppingSession(sessionId, userId) {
    const session = await appRepository.getShoppingSession(sessionId, userId);
    if (!session) throw serviceError(404, 'Shopping session not found');

    return session;
  }

  async function updateShoppingSessionItem(sessionId, itemId, userId, checked) {
    if (typeof checked !== 'boolean') throw serviceError(400, 'checked must be a boolean');
    const session = await appRepository.updateShoppingSessionItem(sessionId, itemId, userId, checked);
    if (!session) throw serviceError(404, 'Shopping session or item not found');

    return session;
  }

  return {
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
  };
}

function aggregateHistory(points) {
  const latestByRetailerDay = new Map();

  for (const point of points || []) {
    const timestamp = new Date(point.observedAt).getTime();
    if (!Number.isFinite(timestamp)) continue;
    const key = `${point.retailerId}:${utcDay(point.observedAt)}`;
    const current = latestByRetailerDay.get(key);

    if (!current || timestamp > new Date(current.observedAt).getTime()) {
      latestByRetailerDay.set(key, point);
    }
  }

  return Array.from(latestByRetailerDay.values()).sort((left, right) => (
    new Date(left.observedAt).getTime() - new Date(right.observedAt).getTime() ||
    String(left.retailerId).localeCompare(String(right.retailerId))
  ));
}

function baselineForecast(offer, latestObservation, baselineReason) {
  const basedOnObservedAt = new Date(latestObservation.observedAt).toISOString();
  return {
    retailerId: offer.retailerId,
    retailerName: offer.retailerName,
    horizonDays: 14,
    predictedPrice: { amount: Number(latestObservation.price?.amount ?? latestObservation.price).toFixed(2), currency: 'AUD' },
    predictedChangePercent: 0,
    forecastKind: 'baseline',
    baselineReason,
    forecastAt: addUtcDays(basedOnObservedAt, 14),
    basedOnObservedAt,
    confidence: null,
    confidenceLabel: null,
    modelVersion: null,
  };
}

function utcDay(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function addUtcDays(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

async function buildSuggestions(repository, items, offers) {
  const suggestions = [];

  for (const item of items) {
    const exactOffers = offers.filter((offer) => String(offer.productId) === String(item.productId));
    if (!exactOffers.length) continue;
    const current = exactOffers.reduce((best, offer) => (
      toCents(offer.price) < toCents(best.price) ? offer : best
    ));

    const alternatives = await repository.getAlternatives(item.productId);
    const candidates = Array.isArray(alternatives)
      ? alternatives
      : alternatives?.similarProducts || [];

    const currentPack = normalizePack(current.packQuantity, current.packUom);
    const replacement = candidates.find((candidate) => {
      const alternativePack = normalizePack(candidate.packQuantity, candidate.packUom);
      const alternativePrice = candidate.cheapestOffer?.price?.amount;

      return isConfiguredStoreBrand(candidate.brand) &&
                currentPack && alternativePack &&
                currentPack.dimension === alternativePack.dimension &&
                packRatio(currentPack.baseQuantity, alternativePack.baseQuantity) >= 0.5 &&
                packRatio(currentPack.baseQuantity, alternativePack.baseQuantity) <= 2 &&
                alternativePrice && toCents(alternativePrice) < toCents(current.price);
    });
    if (!replacement) continue;
    const saving = toCents(current.price) - toCents(replacement.cheapestOffer.price.amount);
    suggestions.push({
      originalProductId: item.productId,
      originalProductName: item.name || item.productName || 'Product',
      replacement,
      estimatedSaving: { amount: formatCents(saving), currency: 'AUD' },
      reason: 'Compatible store-brand pack with a verified lower current price.',
    });
  }

  return suggestions;
}

function isConfiguredStoreBrand(brand) {
  const configured = (process.env.COMPARISON_STORE_BRANDS || 'Farmdale,Coles,Woolworths,Black & Gold')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return configured.includes(String(brand || '').trim().toLowerCase());
}

function packRatio(left, right) {
  return Number(right) / Number(left);
}

function formatCents(value) {
  const whole = value / 100n;
  const fraction = String(value % 100n).padStart(2, '0');

  return `${whole}.${fraction}`;
}

function serializeRetailerResult(result, productById) {
  return {
    ...result,
    itemResults: result.itemResults.map((item) => serializePlanItem(item, productById)),
  };
}

function serializePlanItem(item, productById) {
  const product = productById.get(String(item.productId)) || {};

  return {
    lineItemId: item.lineItemId || null,
    productId: item.productId,
    productName: product.name || product.productName || 'Product',
    imageUrl: product.imageUrl || product.image || null,
    quantity: item.quantity,
    retailerId: item.offer.retailerId,
    retailerName: item.offer.retailerName,
    price: { amount: Number(item.offer.price).toFixed(2), currency: 'AUD' },
    productUrl: item.offer.productUrl || null,
    observedAt: item.offer.observedAt,
    substitution: item.substitution || null,
  };
}

function validateRunInput(input) {
  if (!input || !['lowest_total', 'one_retailer', 'fewest_substitutions'].includes(input.objective)) {
    throw serviceError(400, 'Invalid comparison objective', 'validation_failed');
  }

  if (!Number.isInteger(input.maxRetailers) || input.maxRetailers < 1 || input.maxRetailers > 3) {
    throw serviceError(400, 'maxRetailers must be an integer from 1 to 3', 'validation_failed');
  }
}

function buildRunWarnings(originalItems, resolvedItems, optimized) {
  const warnings = [];

  if (resolvedItems.length < originalItems.length) {
    warnings.push(warning('items', 'unresolved_products', 'Some saved-list products are not mapped to the Silver catalogue.'));
  }

  if (optimized.unavailableProductIds.length) {
    warnings.push(warning('offers', 'missing_retailer_data', 'Some products have no latest compatible retailer price.'));
  }

  return warnings;
}

function warning(section, code, message) {
  return { section, code, message, severity: 'warning' };
}

function allowlistedRetailerUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !ALLOWED_RETAILER_HOSTS.has(url.hostname.toLowerCase())) return null;

    return url.toString();
  } catch {
    return null;
  }
}

function serviceError(status, message, code = null) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;

  return error;
}

module.exports = {
  ALLOWED_RETAILER_HOSTS,
  CALCULATION_POLICY_VERSION,
  allowlistedRetailerUrl,
  createComparisonService,
};
