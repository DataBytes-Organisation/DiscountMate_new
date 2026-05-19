import { DashboardRetailerKey } from "./SavedList";

export type DashboardRangeKey = "30d" | "90d" | "1y";

export type DashboardSummary = {
   user: {
      displayName: string;
      email: string;
      membershipLabel: string;
      profileCompletion: number;
   };
   range: {
      key: DashboardRangeKey;
      label: string;
      startDate: string;
      endDate: string;
      historicalDataAvailable: boolean;
   };
   selectedList: {
      id: string;
      name: string;
      itemCount: number;
      updatedAt: string;
      selectedRetailer: DashboardRetailerKey;
      lastPricedAt: string | null;
   } | null;
   metrics: {
      totalSaved: number;
      totalSpent: number;
      activeAlerts: number;
      unreadNotifications: number;
      shoppingLists: number;
      savingsRate: number;
   };
   trend: {
      labels: string[];
      spent: number[];
      saved: number[];
   };
   recentSnapshots: Array<{
      id: string;
      date: string;
      listName: string;
      selectedRetailer: string;
      comparisonStatus?: "comparable" | "single_retailer" | "no_pricing" | "unpriceable";
      comparableRetailerCount?: number;
      availableRetailers?: string[];
      comparisonLabel?: string;
      cheapestRetailer?: string | null;
      cheapestTotal?: number;
      highestRetailer?: string | null;
      highestTotal?: number;
      selectedTotal: number;
      totalSaved: number;
   }>;
   highlights: {
      subscriptionPlan: string;
      reportUpdatedAt: string | null;
   };
};
