export type Money = {
   amount: string;
   currency: "AUD";
};

export type ComparisonWarning = {
   section: "offers" | "forecast" | "alternatives" | "items" | string;
   code: string;
   message: string;
   severity: "warning" | "error";
};

export type ComparisonProduct = {
   id: string;
   comparisonProductId?: string;
   sourceProductId?: string;
   name: string;
   brand: string | null;
   categoryId?: string | null;
   categoryName: string;
   gtin?: string | null;
   packQuantity: string | null;
   packUom: string | null;
   imageUrl: string | null;
   availableRetailers?: { retailerId: string; retailerName: string }[];
   offerCount?: number;
};

export type RetailerOffer = {
   productId: string;
   sourceProductId?: string;
   retailerId: string;
   retailerName: string;
   price: Money;
   difference: Money;
   unitPrice: string | null;
   packQuantity: string | null;
   packUom: string | null;
   isOnSpecial: boolean;
   specialText: string | null;
   productUrl: string | null;
   observedAt: string;
   availability: "in_stock";
   availabilitySource: "latest_price_inference";
   freshness: "latest";
};

export type PriceHistoryPoint = {
   retailerId: string;
   retailerName: string;
   price: Money;
   observedAt: string;
};

export type ForecastResult = {
   retailerId: string;
   retailerName: string;
   horizonDays: 14;
   predictedPrice: Money;
   predictedChangePercent: number | null;
   forecastKind: "model" | "baseline";
   baselineReason: "insufficient_history" | "model_unavailable" | null;
   forecastAt: string;
   basedOnObservedAt: string;
   confidence: number | null;
   confidenceLabel: "Low" | "Medium" | "High" | null;
   modelVersion: string | null;
};

export type ProductAdvice = {
   type: "buy_now" | "wait" | "compare_offers";
   title: string;
   reason: string;
   basis:
      | "verified_deal"
      | "forecast_drop"
      | "current_price_comparison"
      | "single_offer"
      | "no_offer";
};

export type Alternative = {
   productId: string;
   name: string;
   brand: string | null;
   categoryName: string;
   packQuantity: string;
   packUom: string;
   imageUrl: string | null;
   matchReason?: "same_product_other_size" | "compatible_similar_product";
   matchScore?: number;
   normalizedUnitPrice?: string;
   verifiedSaving?: Money | null;
   cheapestOffer: {
      retailerId: string;
      retailerName: string;
      price: Money;
      unitPrice: string | null;
      productUrl: string | null;
      observedAt: string;
   };
};

export type ProductComparison = {
   comparisonProductId: string;
   product: ComparisonProduct;
   offers: RetailerOffer[];
   unavailableRetailers: {
      retailerId: string;
      retailerName: string;
      reason: "no_exact_product_match" | "no_current_offer" | "incompatible_pack" | "retailer_data_unavailable";
   }[];
   cheapest: RetailerOffer | null;
   history: PriceHistoryPoint[];
   historyObservationDays?: number;
   forecasts: ForecastResult[];
   advice: ProductAdvice;
   alternatives: {
      sameProductOtherSizes: Alternative[];
      similarProducts: Alternative[];
   } | Alternative[];
   dataWatermark: string | null;
   calculationPolicyVersion: string;
   warnings: ComparisonWarning[];
};

export type ComparisonObjective =
   | "lowest_total"
   | "one_retailer"
   | "fewest_substitutions";

export type Coverage = { found: number; total: number };

export type ComparisonPlanItem = {
   lineItemId: string | null;
   productId: string;
   productName: string;
   imageUrl: string | null;
   quantity: number;
   retailerId: string;
   retailerName: string;
   price: Money;
   productUrl: string | null;
   observedAt: string;
   substitution: unknown | null;
};

export type RetailerResult = {
   retailerId: string;
   retailerName: string;
   total: Money;
   savings: Money | null;
   savingsStatus: "verified" | "unavailable";
   comparableItemCount: number;
   coverage: Coverage;
   substitutions: number;
   rankEligible: boolean;
   itemResults: ComparisonPlanItem[];
};

export type ComparisonPlan = {
   id: string;
   retailers: { retailerId: string; retailerName: string }[];
   items: ComparisonPlanItem[];
   total: Money;
   savings: Money | null;
   savingsStatus: "verified" | "unavailable";
   comparableItemCount: number;
   coverage: Coverage;
   substitutions: number;
};

export type GroceryComparisonRun = {
   id: string;
   parentRunId: string | null;
   listId: string;
   listName: string;
   status: "completed";
   objective: ComparisonObjective;
   maxRetailers: 1 | 2 | 3;
   allowStoreBrandSubstitutions: boolean;
   calculationPolicyVersion: string;
   dataWatermark: string | null;
   createdAt: string;
   items: {
      lineItemId?: string;
      productId: string;
      name: string;
      quantity: number;
      substitutionForProductId?: string;
   }[];
   itemResolutions?: {
      lineItemId?: string;
      legacyProductId?: string;
      productId?: string;
      name: string;
      quantity: number;
      imageUrl?: string | null;
      resolutionStatus?: "resolved" | "unresolved" | "ambiguous";
      resolutionReason?: string;
   }[];
   retailerResults: RetailerResult[];
   plans: ComparisonPlan[];
   unavailableProductIds: string[];
   warnings: ComparisonWarning[];
   suggestions?: {
      id: string;
      originalProductId: string;
      originalProductName: string;
      replacement: Alternative;
      estimatedSaving: Money;
      reason: string;
   }[];
};

export type ShoppingStartResult = {
   runId: string;
   planId: string;
   retailers: { retailerName: string; urls: string[] }[];
   sessionId: string;
   groups: ShoppingRetailerGroup[];
};

export type RetailerCapability = "product_page" | "store_required" | "catalogue_only";
export type RetailerLinkStatus = "exact" | "missing" | "unsupported";

export type ShoppingSessionItem = ComparisonPlanItem & {
   checked: boolean;
   retailerCapability: RetailerCapability;
   linkStatus: RetailerLinkStatus;
};

export type ShoppingRetailerGroup = {
   retailerName: string;
   retailerCapability: RetailerCapability;
   items: ShoppingSessionItem[];
};

export type ShoppingSession = {
   id: string;
   runId: string;
   planId: string;
   status: "active" | "completed";
   createdAt: string;
   updatedAt?: string;
   groups: ShoppingRetailerGroup[];
};
