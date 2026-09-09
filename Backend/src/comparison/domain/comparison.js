const CURRENCY = 'AUD';

function toCents(value) {
  const raw = String(value ?? '0').trim();
  const match = raw.match(/^(-?)(\d+)(?:\.(\d*))?$/);
  if (!match) throw new TypeError(`Invalid money value: ${raw}`);

  const negative = match[1] === '-';
  const fraction = (match[3] || '').padEnd(3, '0');
  let cents = BigInt(match[2]) * 100n + BigInt(fraction.slice(0, 2));
  if (Number(fraction[2] || 0) >= 5) cents += 1n;

  return negative ? -cents : cents;
}

function centsToAmount(cents) {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, '0');

  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

function money(cents, currency = CURRENCY) {
  return { amount: centsToAmount(cents), currency };
}

function addMoney(values) {
  return centsToAmount(values.reduce((sum, value) => sum + toCents(value), 0n));
}

function normalizePack(quantity, uom) {
  const value = Number(quantity);
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = String(uom || '').trim().toLowerCase();
  const definitions = {
    g: ['mass', value / 1000, 'kg'],
    kg: ['mass', value, 'kg'],
    ml: ['volume', value / 1000, 'L'],
    l: ['volume', value, 'L'],
    ea: ['count', value, 'each'],
    each: ['count', value, 'each'],
    pack: ['count', value, 'each'],
  };

  const definition = definitions[unit];
  if (!definition) return null;

  return {
    dimension: definition[0],
    baseQuantity: Number(definition[1]).toFixed(3),
    baseUnit: definition[2],
  };
}

function arePacksCompatible(left, right) {
  const a = normalizePack(left?.packQuantity, left?.packUom);
  const b = normalizePack(right?.packQuantity, right?.packUom);

  return Boolean(a && b && a.dimension === b.dimension && a.baseQuantity === b.baseQuantity);
}

function hasValidObservation(observedAt) {
  return !Number.isNaN(new Date(observedAt).getTime());
}

function hasPositivePrice(price) {
  try {
    return toCents(price) > 0n;
  } catch {
    return false;
  }
}

function isUsableOffer(offer) {
  return hasPositivePrice(offer?.price) && hasValidObservation(offer?.observedAt);
}

function excludedOfferReason(offer) {
  if (!hasPositivePrice(offer?.price)) return 'invalid_price';
  if (!hasValidObservation(offer?.observedAt)) return 'invalid_observation';

  return null;
}

function compareExactOffers(inputOffers) {
  const eligible = inputOffers.filter(isUsableOffer);
  const invalidOffers = inputOffers.filter((offer) => !isUsableOffer(offer));
  const reference = eligible[0];
  const compatible = reference
    ? eligible.filter((offer) => arePacksCompatible(reference, offer))
    : [];

  compatible.sort((a, b) => {
    const priceDifference = compareBigInt(toCents(a.price), toCents(b.price));

    return priceDifference || String(a.retailerId).localeCompare(String(b.retailerId));
  });

  const cheapest = compatible[0] || null;
  const cheapestCents = cheapest ? toCents(cheapest.price) : 0n;
  const offers = compatible.map((offer) => ({
    ...offer,
    price: money(toCents(offer.price), offer.currency || CURRENCY),
    difference: money(toCents(offer.price) - cheapestCents, offer.currency || CURRENCY),
    availability: 'in_stock',
    availabilitySource: 'latest_price_inference',
    freshness: 'latest',
  }));

  return {
    cheapest: offers[0] || null,
    offers,
    excludedOffers: [
      ...invalidOffers.map((offer) => ({ ...offer, reason: excludedOfferReason(offer) })),
      ...eligible.filter((offer) => !compatible.includes(offer)).map((offer) => ({
        ...offer,
        reason: 'incompatible_pack',
      })),
    ],
  };
}

function confidenceLabel(value) {
  const normalized = Number(value);
  const percent = normalized <= 1 ? normalized * 100 : normalized;
  if (!Number.isFinite(percent) || percent < 55) return 'Low';
  if (percent < 75) return 'Medium';

  return 'High';
}

function evaluateAdvice({
  specialText = '',
  isNinetyDayLow = false,
  isBestObservedDiscount = false,
  predictedChangePercent,
  confidence,
  forecastKind,
  offers = [],
}) {
  if (/(?:half[\s-]*price|1\/2[\s-]*price)/i.test(specialText) || isNinetyDayLow || isBestObservedDiscount) {
    return {
      type: 'buy_now',
      title: 'Buy now',
      reason: 'The current offer meets the verified deal policy.',
      basis: 'verified_deal',
    };
  }

  const confidencePercent = Number(confidence) <= 1 ? Number(confidence) * 100 : Number(confidence);

  if (forecastKind === 'model' && Number(predictedChangePercent) <= -5 && confidencePercent >= 55) {
    return {
      type: 'wait',
      title: 'Wait',
      reason: 'A price decrease of at least 5% is forecast with sufficient confidence.',
      basis: 'forecast_drop',
    };
  }

  return currentOfferAdvice(offers);
}

function currentOfferAdvice(inputOffers) {
  const offers = (inputOffers || [])
    .map((offer, index) => ({
      retailerName: retailerDisplayName(offer?.retailerName),
      price: offerPrice(offer?.price),
      index,
    }))
    .filter((offer) => offer.retailerName && offer.price != null)
    .sort((left, right) => left.price - right.price || left.index - right.index);

  if (!offers.length) {
    return {
      type: 'compare_offers',
      title: 'Compare current offers',
      reason: 'No compatible current offers are available.',
      basis: 'no_offer',
    };
  }

  if (offers.length === 1) {
    return {
      type: 'compare_offers',
      title: 'Compare current offers',
      reason: `One verified current offer is available at ${offers[0].retailerName} for $${offers[0].price.toFixed(2)}.`,
      basis: 'single_offer',
    };
  }

  const minimum = offers[0].price;
  const cheapest = offers.filter((offer) => offer.price === minimum);
  if (cheapest.length > 1) {
    return {
      type: 'compare_offers',
      title: 'Compare current offers',
      reason: `The lowest current price is $${minimum.toFixed(2)} at ${joinNames(cheapest.map((offer) => offer.retailerName))}.`,
      basis: 'current_price_comparison',
    };
  }

  const maximum = offers.at(-1).price;
  return {
    type: 'compare_offers',
    title: 'Compare current offers',
    reason: `Current prices range from $${minimum.toFixed(2)} at ${offers[0].retailerName} to $${maximum.toFixed(2)} across ${offers.length} retailers.`,
    basis: 'current_price_comparison',
  };
}

function offerPrice(value) {
  const numeric = Number(value?.amount ?? value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function retailerDisplayName(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const names = { aldi: 'ALDI', iga: 'IGA', coles: 'Coles', woolworths: 'Woolworths' };
  return names[normalized] || String(value || '').trim();
}

function joinNames(names) {
  if (names.length < 2) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

function optimizeBasket({ items, offers, objective, maxRetailers }) {
  const normalizedObjective = ['lowest_total', 'one_retailer', 'fewest_substitutions'].includes(objective)
    ? objective
    : 'lowest_total';

  const retailerLimit = Math.min(3, Math.max(1, Number(maxRetailers) || 1));
  const itemById = new Map(items.map((item, index) => {
    const productId = String(item.productId);
    const lineItemId = String(item.lineItemId || `${productId}:${index}`);

    return [lineItemId, {
      ...item,
      lineItemId,
      productId,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    }];
  }));

  const requestedProductIds = new Set(Array.from(itemById.values(), (item) => item.productId));
  const eligibleOffers = offers.filter((offer) => (
    requestedProductIds.has(String(offer.productId)) && isUsableOffer(offer)
  ));

  const offersByProduct = groupBy(eligibleOffers, (offer) => String(offer.productId));

  for (const [productId, productOffers] of offersByProduct) {
    const reference = productOffers[0];
    offersByProduct.set(productId, productOffers.filter((offer) => arePacksCompatible(reference, offer)));
  }

  const retailers = uniqueBy(eligibleOffers, (offer) => String(offer.retailerId))
    .map((offer) => ({ retailerId: String(offer.retailerId), retailerName: offer.retailerName }))
    .sort((a, b) => a.retailerId.localeCompare(b.retailerId));

  const retailerResults = retailers.map((retailer) => buildRetailerResult(
    retailer,
    itemById,
    offersByProduct,
  ));

  const maxCoverage = Math.max(0, ...retailerResults.map((row) => row.coverage.found));
  retailerResults.forEach((row) => {
    row.rankEligible = row.coverage.found === maxCoverage;
  });

  const allowedSizes = normalizedObjective === 'one_retailer'
    ? [1]
    : Array.from({ length: retailerLimit }, (_, index) => index + 1);

  const combinations = allowedSizes.flatMap((size) => combinationsOf(retailers, size));
  const plans = combinations
    .map((combination) => buildPlan(combination, itemById, offersByProduct))
    .filter((plan) => plan.coverage.found > 0)
    .sort(planComparator(normalizedObjective));

  return {
    objective: normalizedObjective,
    retailerResults,
    plans,
    unavailableProductIds: Array.from(new Set(
      Array.from(itemById.values())
        .filter((item) => (offersByProduct.get(item.productId) || []).length === 0)
        .map((item) => item.productId),
    )),
  };
}

function buildRetailerResult(retailer, itemById, offersByProduct) {
  let total = 0n;
  let savings = 0n;
  const itemResults = [];
  let comparableItemCount = 0;

  for (const [lineItemId, item] of itemById) {
    const compatibleOffers = offersByProduct.get(item.productId) || [];
    const retailerOffer = compatibleOffers.find((offer) => String(offer.retailerId) === retailer.retailerId);
    if (!retailerOffer) continue;

    const quantity = BigInt(item.quantity);
    const price = toCents(retailerOffer.price);
    const highest = compatibleOffers.reduce(
      (current, offer) => maxBigInt(current, toCents(offer.price)),
      price,
    );
    total += price * quantity;

    if (compatibleOffers.length > 1) {
      savings += (highest - price) * quantity;
      comparableItemCount += 1;
    }
    itemResults.push({
      lineItemId,
      productId: item.productId,
      quantity: item.quantity,
      offer: retailerOffer,
      substitution: item.substitutionForProductId
        ? { originalProductId: item.substitutionForProductId }
        : null,
    });
  }

  return {
    ...retailer,
    total: money(total),
    savings: comparableItemCount > 0 ? money(savings) : null,
    savingsStatus: comparableItemCount > 0 ? 'verified' : 'unavailable',
    comparableItemCount,
    coverage: { found: itemResults.length, total: itemById.size },
    itemResults,
    substitutions: itemResults.filter((item) => item.substitution).length,
  };
}

function buildPlan(retailers, itemById, offersByProduct) {
  const retailerIds = new Set(retailers.map((retailer) => retailer.retailerId));
  let total = 0n;
  let baseline = 0n;
  const planItems = [];
  let comparableItemCount = 0;

  for (const [lineItemId, item] of itemById) {
    const compatibleOffers = offersByProduct.get(item.productId) || [];
    const eligible = compatibleOffers
      .filter((offer) => retailerIds.has(String(offer.retailerId)))
      .sort((a, b) => (
        compareBigInt(toCents(a.price), toCents(b.price)) ||
                String(a.retailerId).localeCompare(String(b.retailerId))
      ));
    if (!eligible.length) continue;

    const selected = eligible[0];
    const quantity = BigInt(item.quantity);
    const highest = compatibleOffers.reduce(
      (current, offer) => maxBigInt(current, toCents(offer.price)),
      toCents(selected.price),
    );
    total += toCents(selected.price) * quantity;

    if (compatibleOffers.length > 1) {
      baseline += highest * quantity;
      comparableItemCount += 1;
    } else {
      baseline += toCents(selected.price) * quantity;
    }
    planItems.push({
      lineItemId,
      productId: item.productId,
      quantity: item.quantity,
      offer: selected,
      substitution: item.substitutionForProductId
        ? { originalProductId: item.substitutionForProductId }
        : null,
    });
  }

  return {
    retailers,
    items: planItems,
    total: money(total),
    savings: comparableItemCount > 0 ? money(baseline - total) : null,
    savingsStatus: comparableItemCount > 0 ? 'verified' : 'unavailable',
    comparableItemCount,
    coverage: { found: planItems.length, total: itemById.size },
    substitutions: planItems.filter((item) => item.substitution).length,
  };
}

function planComparator(objective) {
  return (left, right) => {
    const coverage = right.coverage.found - left.coverage.found;
    if (coverage) return coverage;

    if (objective === 'fewest_substitutions') {
      const substitutions = left.substitutions - right.substitutions;
      if (substitutions) return substitutions;
    }

    const total = compareBigInt(toCents(left.total.amount), toCents(right.total.amount));
    if (total) return total;

    if (objective === 'lowest_total') {
      const retailerCount = left.retailers.length - right.retailers.length;
      if (retailerCount) return retailerCount;
    }

    if (objective !== 'fewest_substitutions') {
      const substitutions = left.substitutions - right.substitutions;
      if (substitutions) return substitutions;
    }

    if (objective === 'fewest_substitutions') {
      const retailerCount = left.retailers.length - right.retailers.length;
      if (retailerCount) return retailerCount;
    }

    return left.retailers.map((retailer) => retailer.retailerId).join(',')
      .localeCompare(right.retailers.map((retailer) => retailer.retailerId).join(','));
  };
}

function groupBy(values, keyFn) {
  const result = new Map();
  values.forEach((value) => {
    const key = keyFn(value);
    result.set(key, [...(result.get(key) || []), value]);
  });

  return result;
}

function uniqueBy(values, keyFn) {
  return Array.from(new Map(values.map((value) => [keyFn(value), value])).values());
}

function combinationsOf(values, size) {
  if (size === 0) return [[]];
  if (values.length < size) return [];
  if (size === 1) return values.map((value) => [value]);

  return values.flatMap((value, index) => combinationsOf(values.slice(index + 1), size - 1)
    .map((tail) => [value, ...tail]));
}

function compareBigInt(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function maxBigInt(left, right) {
  return left > right ? left : right;
}

module.exports = {
  addMoney,
  arePacksCompatible,
  compareExactOffers,
  confidenceLabel,
  evaluateAdvice,
  normalizePack,
  optimizeBasket,
  toCents,
};
