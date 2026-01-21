// Frontend/lib/insightsData.ts
export type Retailer = {
  name: string;
  price: string;          // e.g. "$4.50"
  originalPrice?: string; // e.g. "$6.00"
  isCheapest?: boolean;
};

export type InsightsProduct = {
  id: string;
  name: string;
  subtitle?: string;
  category?: string; // important for Categories insights
  retailers: Retailer[];
};

/** Parse "$4.50" / "4.50" / "AUD 4.50" -> 4.5 */
export function parseMoney(input?: string): number | null {
  if (!input) return null;
  const numeric = parseFloat(String(input).replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

export function computeRetailerRow(ret: Retailer) {
  const current = parseMoney(ret.price);
  const original = parseMoney(ret.originalPrice);
  const savings =
    current != null && original != null && original > current ? original - current : 0;

  const discountPct =
    current != null && original != null && original > 0 && original > current
      ? (savings / original) * 100
      : 0;

  return { current, original, savings, discountPct };
}

export function normalizeCheapest(retailers: Retailer[]): Retailer[] {
  if (!retailers || retailers.length === 0) return [];
  const hasExplicit = retailers.some((r) => r.isCheapest);
  if (hasExplicit) return retailers;

  const scored = retailers.map((r) => {
    const current = parseMoney(r.price);
    return { r, current: current ?? Number.POSITIVE_INFINITY };
  });

  const min = scored.reduce((a, b) => (b.current < a.current ? b : a));
  return retailers.map((r) => (r === min.r ? { ...r, isCheapest: true } : r));
}

/**
 * Fetch products for insights.
 * IMPORTANT: adjust the endpoint to match your backend if needed.
 *
 * Expected response: InsightsProduct[] or { products: InsightsProduct[] }
 */
export async function fetchProductsForInsights(): Promise<InsightsProduct[]> {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL;

  // If you haven't set an API base URL yet, it will fallback to mock
  if (!base) return mockProducts();

  const candidates = [
    `${base}/products`,
    `${base}/api/products`,
    `${base}/specials`,
    `${base}/api/specials`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();

      const arr: any[] =
        Array.isArray(json) ? json : Array.isArray(json?.products) ? json.products : [];

      // Basic shape check
      const cleaned: InsightsProduct[] = arr
        .filter((p) => p && p.id && p.name && Array.isArray(p.retailers))
        .map((p) => ({
          id: String(p.id),
          name: String(p.name),
          subtitle: p.subtitle ? String(p.subtitle) : "",
          category: p.category ? String(p.category) : p.subtitle ? String(p.subtitle) : "Other",
          retailers: (p.retailers || []).map((r: any) => ({
            name: String(r.name ?? r.retailer ?? "Unknown"),
            price: String(r.price ?? ""),
            originalPrice: r.originalPrice ? String(r.originalPrice) : undefined,
            isCheapest: Boolean(r.isCheapest),
          })),
        }));

      if (cleaned.length) return cleaned;
    } catch {
      // try next candidate
    }
  }

  return mockProducts();
}

/** Works immediately so your pages aren't empty while you wire the API */
function mockProducts(): InsightsProduct[] {
  return [
    {
      id: "p1",
      name: "Greek Yogurt 1kg",
      category: "Dairy, Eggs & Fridge",
      retailers: normalizeCheapest([
        { name: "Coles", price: "$6.00", originalPrice: "$7.50" },
        { name: "Woolworths", price: "$6.50", originalPrice: "$7.50" },
        { name: "Aldi", price: "$5.80", originalPrice: "$7.00" },
      ]),
    },
    {
      id: "p2",
      name: "Dishwashing Liquid 750ml",
      category: "Household",
      retailers: normalizeCheapest([
        { name: "Coles", price: "$4.50", originalPrice: "$6.00" },
        { name: "Woolworths", price: "$4.20", originalPrice: "$6.00" },
        { name: "Aldi", price: "$4.80", originalPrice: "$5.50" },
      ]),
    },
    {
      id: "p3",
      name: "Bananas 1kg",
      category: "Fruit & Vegetables",
      retailers: normalizeCheapest([
        { name: "Coles", price: "$3.40", originalPrice: "$4.20" },
        { name: "Woolworths", price: "$3.60", originalPrice: "$4.20" },
        { name: "Aldi", price: "$3.20", originalPrice: "$4.00" },
      ]),
    },
  ];
}
