export type DashboardRetailerKey = "aldi" | "coles" | "woolworths" | "iga";

export type SavedListSummary = {
   id: string;
   name: string;
   itemCount: number;
   updatedAt: string;
};

export type ListPricingSnapshot = {
   id: string;
   savedListId: string;
   selectedRetailer: DashboardRetailerKey | null;
   retailerTotals: Partial<Record<DashboardRetailerKey, number>>;
   comparisonStatus?: "comparable" | "single_retailer" | "no_pricing" | "unpriceable";
   comparableRetailerCount?: number;
   availableRetailers?: DashboardRetailerKey[];
   cheapestRetailer: DashboardRetailerKey | null;
   cheapestTotal: number;
   highestRetailer?: DashboardRetailerKey | null;
   highestTotal?: number;
   selectedTotal: number;
   totalSaved: number;
   savingsRate: number;
   itemCount: number;
   createdAt: string;
};
