import {
   PriceAlert,
   PriceAlertChannels,
   PriceAlertCondition,
   PriceAlertDelivery,
} from "../types/PriceAlert";

export type PriceAlertFormInput = {
   productCode: string;
   condition: PriceAlertCondition;
   threshold: string;
   channels: PriceAlertChannels;
   editingId?: string;
};

export const CONDITION_LABELS: Record<PriceAlertCondition, string> = {
   price_at_or_below: "Price drops to or below $X",
   percent_off_at_least: "Discounted by at least X%",
};

export function validatePriceAlertInput(
   input: PriceAlertFormInput,
   existingAlerts: PriceAlert[] = []
): Record<string, string> {
   const errors: Record<string, string> = {};
   const isPercent = input.condition === "percent_off_at_least";
   const raw = input.threshold.trim();
   const threshold = Number(raw);

   if (!input.productCode.trim()) {
      errors.product = "Search for a product and pick one from the results.";
   }

   if (!raw || !Number.isFinite(threshold)) {
      errors.threshold = isPercent ? "Enter a discount percentage." : "Enter a target price.";
   } else if (threshold <= 0) {
      errors.threshold = isPercent
         ? "Discount must be greater than 0%."
         : "Target price must be greater than $0.";
   } else if (isPercent && threshold > 100) {
      errors.threshold = "Discount cannot be more than 100%.";
   } else if (!isPercent && threshold > 10000) {
      errors.threshold = "Target price cannot be more than $10,000.";
   } else if (!isPercent && !/^\d+(\.\d{1,2})?$/.test(raw)) {
      errors.threshold = "Target price can have at most 2 decimal places.";
   }

   if (!input.channels.email && !input.channels.push) {
      errors.channels = "Select at least one notification channel.";
   }

   const duplicate = existingAlerts.some(
      (alert) =>
         alert.id !== input.editingId &&
         alert.productCode === input.productCode &&
         alert.condition === input.condition &&
         alert.threshold === threshold
   );
   if (Object.keys(errors).length === 0 && duplicate) {
      errors.duplicate = "You already have an identical alert.";
   }

   return errors;
}

export function formatPrice(value: number | null): string {
   return typeof value === "number" ? `$${value.toFixed(2)}` : "-";
}

export function describeCondition(alert: Pick<PriceAlert, "condition" | "threshold">): string {
   if (alert.condition === "percent_off_at_least") {
      return `Discounted by at least ${alert.threshold}%`;
   }

   return `Price drops to or below ${formatPrice(alert.threshold)}`;
}

export function describeDelivery(delivery: PriceAlertDelivery | null): string {
   if (!delivery) {
      return "No notifications sent yet";
   }

   const channel = delivery.channel === "push" ? "Push" : "Email";
   switch (delivery.status) {
      case "sent":
         return `${channel} sent`;
      case "retrying":
         return `${channel} failed – retrying`;
      case "failed":
         return `${channel} delivery failed`;
      case "exhausted":
         return `${channel} delivery failed after retries`;
      case "skipped":
         if (delivery.errorCode === "no_push_tokens") {
            return "Push skipped – no device registered";
         }
         return `${channel} skipped – turned off in your preferences`;
      case "not_configured":
         return `${channel} not configured on server`;
      default:
         return `${channel} delivery status unknown`;
   }
}
