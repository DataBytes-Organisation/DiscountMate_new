import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/Api";
import { PriceAlert, PriceAlertInput, PriceAlertStatus } from "../types/PriceAlert";
import { normalizeApiErrorMessage } from "../utils/authSession";

export type PriceAlertValidationError = Error & {
   fieldErrors: Record<string, string>;
};

async function getAuthToken(): Promise<string> {
   const token = await AsyncStorage.getItem("authToken");
   if (!token) {
      throw new Error("You need to log in to manage price alerts.");
   }

   return token;
}

async function buildError(response: Response, data: any, fallback: string) {
   const error = new Error(
      await normalizeApiErrorMessage(data?.message, fallback)
   ) as PriceAlertValidationError;

   error.fieldErrors = {};
   if (response.status === 400 && Array.isArray(data?.errors)) {
      data.errors.forEach((entry: any) => {
         const path = String(entry?.path || "").split(".")[0];
         const field = path === "product_code" ? "product" : path;
         if (field && entry?.msg && !error.fieldErrors[field]) {
            error.fieldErrors[field] = String(entry.msg);
         }
      });
   }

   return error;
}

function mapAlert(alert: any): PriceAlert {
   const channels = alert.channels || {};

   return {
      id: String(alert._id ?? alert.id),
      productCode: String(alert.product_code),
      productName: alert.product_name || "Unnamed product",
      condition: alert.condition === "percent_off_at_least" ? "percent_off_at_least" : "price_at_or_below",
      threshold: Number(alert.threshold) || 0,
      channels: {
         email: typeof channels.email === "boolean" ? channels.email : false,
         push: typeof channels.push === "boolean" ? channels.push : false,
      },
      status: alert.status === "disabled" ? "disabled" : "enabled",
      lastEvaluatedAt: alert.last_evaluated_at || null,
      lastTriggeredAt: alert.last_triggered_at || null,
      lastPriceSeen: typeof alert.last_price_seen === "number" ? alert.last_price_seen : null,
      lastDelivery: alert.last_delivery
         ? {
              channel: alert.last_delivery.channel === "push" ? "push" : "email",
              status: alert.last_delivery.status,
              attemptedAt: alert.last_delivery.attempted_at || null,
              errorCode: alert.last_delivery.error_code || null,
           }
         : null,
      createdAt: typeof alert.created_at === "string" ? alert.created_at : new Date().toISOString(),
      updatedAt: typeof alert.updated_at === "string" ? alert.updated_at : new Date().toISOString(),
   };
}

async function request(path: string, fallback: string, options: RequestInit = {}) {
   const token = await getAuthToken();
   const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${token}`,
      },
   });

   const data = await response.json();
   if (!response.ok) {
      throw await buildError(response, data, fallback);
   }

   return data;
}

export async function fetchPriceAlerts(): Promise<PriceAlert[]> {
   const data = await request("/price-alerts", "Unable to load price alerts.");
   return Array.isArray(data?.alerts) ? data.alerts.map(mapAlert) : [];
}

export async function createPriceAlert(input: PriceAlertInput): Promise<PriceAlert> {
   const data = await request("/price-alerts", "Unable to create price alert.", {
      method: "POST",
      body: JSON.stringify({
         product_code: input.productCode,
         condition: input.condition,
         threshold: input.threshold,
         channels: input.channels,
      }),
   });
   return mapAlert(data.alert);
}

export async function updatePriceAlert(
   id: string,
   input: Omit<PriceAlertInput, "productCode">
): Promise<PriceAlert> {
   const data = await request(
      `/price-alerts/${encodeURIComponent(id)}`,
      "Unable to update price alert.",
      { method: "PUT", body: JSON.stringify(input) }
   );
   return mapAlert(data.alert);
}

export async function setPriceAlertStatus(
   id: string,
   status: PriceAlertStatus
): Promise<PriceAlert> {
   const data = await request(
      `/price-alerts/${encodeURIComponent(id)}/status`,
      "Unable to update price alert.",
      { method: "PATCH", body: JSON.stringify({ status }) }
   );
   return mapAlert(data.alert);
}

export async function deletePriceAlert(id: string): Promise<void> {
   await request(`/price-alerts/${encodeURIComponent(id)}`, "Unable to delete price alert.", {
      method: "DELETE",
   });
}
