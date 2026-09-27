const EVENT_CATALOGUE = new Set([
  'comparison_viewed',
  'comparison_failed',
  'product_selected',
  'retailer_filter_changed',
  'similar_products_toggled',
  'comparison_run_completed',
  'optimizer_changed',
  'substitution_applied',
  'substitution_dismissed',
  'export_completed',
  'offer_opened',
  'shopping_started',
  'shopping_session_viewed',
  'shopping_item_checked',
  'retailer_opened',
  'mock_cart_created',
  'shopping_completed',
  'retailer_product_opened',
  'retailer_link_failed',
  'shopping_item_completed',
  'shopping_session_completed',
]);

function validateTrackingEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new TypeError('At least one event is required');
  }
  if (events.length > 50) throw new TypeError('A batch cannot contain more than 50 events');

  return events.map((event) => {
    if (!EVENT_CATALOGUE.has(event?.name)) {
      throw new TypeError(`Tracking event ${event?.name || '(missing)'} is not allowed`);
    }

    const properties = event.properties && typeof event.properties === 'object'
      ? event.properties
      : {};

    if (Buffer.byteLength(JSON.stringify(properties), 'utf8') > 8192) {
      throw new TypeError('Tracking event properties exceed 8 KB');
    }

    const occurredAt = event.occurredAt ? new Date(event.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) throw new TypeError('Tracking event timestamp is invalid');

    return {
      name: event.name,
      occurredAt: occurredAt.toISOString(),
      properties,
      anonymousSessionId: event.anonymousSessionId || null,
    };
  });
}

module.exports = { EVENT_CATALOGUE, validateTrackingEvents };
