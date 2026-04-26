export type SubscriptionPlanKey = "free" | "premium" | "family";

export type SubscriptionPlan = {
   key: SubscriptionPlanKey;
   label: string;
   priceLabel: string;
   priceSuffix: string;
   badge?: string | null;
   current: boolean;
   features: string[];
   limits: {
      priceAlerts: number | null;
      savedLists: number | null;
   };
};

export type SubscriptionUsageMetric = {
   label: string;
   used: number;
   limit: number | null;
};

export type SubscriptionSummary = {
   currentPlan: SubscriptionPlanKey;
   currentPlanLabel: string;
   currentPriceLabel: string;
   currentPriceSuffix: string;
   plans: SubscriptionPlan[];
   usage: {
      priceAlerts: SubscriptionUsageMetric;
      savedLists: SubscriptionUsageMetric;
   };
};
