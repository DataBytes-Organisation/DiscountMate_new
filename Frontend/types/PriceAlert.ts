export type PriceAlertCondition = "price_at_or_below" | "percent_off_at_least";

export type PriceAlertStatus = "enabled" | "disabled";

export type PriceAlertChannels = {
   email: boolean;
   push: boolean;
};

export type PriceAlertDelivery = {
   channel: "email" | "push";
   status: "sent" | "failed" | "retrying" | "exhausted" | "skipped" | "not_configured";
   attemptedAt: string | null;
   errorCode: string | null;
};

export type PriceAlert = {
   id: string;
   productCode: string;
   productName: string;
   condition: PriceAlertCondition;
   threshold: number;
   channels: PriceAlertChannels;
   status: PriceAlertStatus;
   lastEvaluatedAt: string | null;
   lastTriggeredAt: string | null;
   lastPriceSeen: number | null;
   lastDelivery: PriceAlertDelivery | null;
   createdAt: string;
   updatedAt: string;
};

export type PriceAlertInput = {
   productCode: string;
   condition: PriceAlertCondition;
   threshold: number;
   channels: PriceAlertChannels;
};
