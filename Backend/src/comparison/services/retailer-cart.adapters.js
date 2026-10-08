class ProductLinkRetailerAdapter {
  constructor(allowUrl = () => null) {
    this.allowUrl = allowUrl;
  }

  createGroups(items) {
    const grouped = new Map();

    for (const item of items || []) {
      const retailerName = item.retailerName || 'Retailer';
      const productUrl = this.allowUrl(item.productUrl);
      const retailerCapability = capabilityForRetailer(retailerName);
      grouped.set(retailerName, [...(grouped.get(retailerName) || []), {
        ...structuredClone(item),
        productUrl,
        retailerCapability,
        linkStatus: retailerCapability === 'catalogue_only'
          ? 'unsupported'
          : productUrl ? 'exact' : 'missing',
        checked: false,
      }]);
    }

    return Array.from(grouped, ([retailerName, retailerItems]) => ({
      retailerName,
      retailerCapability: capabilityForRetailer(retailerName),
      items: retailerItems,
    })).sort((left, right) => left.retailerName.localeCompare(right.retailerName));
  }
}

function capabilityForRetailer(retailerName) {
  const key = String(retailerName || '').trim().toLowerCase();
  if (key === 'aldi') return 'catalogue_only';
  if (key === 'iga') return 'store_required';
  if (key === 'coles' || key === 'woolworths') return 'product_page';
  return 'product_page';
}

class MockRetailerCartAdapter {
  createCart(session) {
    return {
      provider: 'discountmate_sandbox',
      sessionId: session.id,
      checkoutPath: `/shopping-session/${encodeURIComponent(session.id)}/sandbox`,
      acceptsPayment: false,
    };
  }
}

module.exports = { MockRetailerCartAdapter, ProductLinkRetailerAdapter, capabilityForRetailer };
