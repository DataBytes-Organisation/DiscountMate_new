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
   cheapestRetailer: DashboardRetailerKey | null;
   cheapestTotal: number;
   selectedTotal: number;
   totalSaved: number;
   savingsRate: number;
   itemCount: number;
   createdAt: string;
};
