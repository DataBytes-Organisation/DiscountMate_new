import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { API_URL } from "../constants/Api";
import type {
   ComparisonObjective,
   ComparisonProduct,
   GroceryComparisonRun,
   ProductComparison,
   ShoppingStartResult,
   ShoppingSession,
} from "../types/Comparison";

type ApiEnvelope<T> = { data: T; message?: string; code?: string };

export class ComparisonRequestError extends Error {
   constructor(message: string, public readonly code: string, public readonly status: number) {
      super(message);
      this.name = "ComparisonRequestError";
   }
}

export function comparisonErrorMessage(code?: string, fallback?: string): string {
   const messages: Record<string, string> = {
      authentication_required: "Please log in to compare a saved grocery list.",
      list_not_found: "This saved grocery list could not be found or is no longer available.",
      no_mapped_items: "None of this list’s products are mapped to the comparison catalogue yet.",
      de_unavailable: "Live retailer data is temporarily unavailable. Retry after the comparison service reconnects.",
      app_database_unavailable: "The comparison could not be saved. Your grocery list has not been changed.",
      validation_failed: "The comparison settings are invalid. Review the selected options and retry.",
   };
   return (code && messages[code]) || fallback || "Comparison data is temporarily unavailable.";
}

async function request<T>(path: string, init: RequestInit = {}, authenticated: boolean | "optional" = false): Promise<T> {
   const token = authenticated ? await AsyncStorage.getItem("authToken") : null;
   if (authenticated === true && !token) throw new Error("Please log in to compare a saved grocery list.");
   const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
         "Content-Type": "application/json",
         ...(token ? { Authorization: `Bearer ${token}` } : {}),
         ...(init.headers || {}),
      },
   });
   const payload = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
   if (!response.ok) {
      const code = payload.code || "comparison_unavailable";
      throw new ComparisonRequestError(comparisonErrorMessage(code, payload.message), code, response.status);
   }
   return payload.data as T;
}

export async function searchComparisonProducts(search: string): Promise<ComparisonProduct[]> {
   if (search.trim().length < 2) return [];
   return request<ComparisonProduct[]>(`/comparisons/products?search=${encodeURIComponent(search.trim())}`);
}

export async function fetchProductComparison(
   productId: string,
   options: { range: string; retailerIds: string[]; includeSimilar: boolean }
): Promise<ProductComparison> {
   const params = new URLSearchParams({
      range: options.range,
      "include-similar": String(options.includeSimilar),
   });
   if (options.retailerIds.length) params.set("retailers", options.retailerIds.join(","));
   const comparison = await request<ProductComparison>(
      `/comparisons/products/${encodeURIComponent(productId)}?${params.toString()}`
   );
   return normalizeProductComparison(comparison);
}

export function normalizeProductComparison(comparison: ProductComparison): ProductComparison {
   return {
      ...comparison,
      offers: Array.isArray(comparison?.offers) ? comparison.offers : [],
      unavailableRetailers: Array.isArray(comparison?.unavailableRetailers)
         ? comparison.unavailableRetailers
         : [],
      history: Array.isArray(comparison?.history) ? comparison.history : [],
      forecasts: Array.isArray(comparison?.forecasts) ? comparison.forecasts : [],
      warnings: Array.isArray(comparison?.warnings) ? comparison.warnings : [],
      alternatives: comparison?.alternatives || {
         sameProductOtherSizes: [],
         similarProducts: [],
      },
   };
}

export async function createGroceryComparisonRun(
   listId: string,
   input: {
      objective: ComparisonObjective;
      maxRetailers: 1 | 2 | 3;
      allowStoreBrandSubstitutions: boolean;
   }
): Promise<GroceryComparisonRun> {
   return request<GroceryComparisonRun>(`/comparisons/lists/${encodeURIComponent(listId)}/runs`, {
      method: "POST",
      body: JSON.stringify(input),
   }, true);
}

export async function applyComparisonSubstitution(
   runId: string,
   input: { originalProductId: string; replacementProductId: string }
): Promise<GroceryComparisonRun> {
   return request<GroceryComparisonRun>(
      `/comparisons/runs/${encodeURIComponent(runId)}/substitutions/apply`,
      { method: "POST", body: JSON.stringify(input) },
      true
   );
}

export async function dismissComparisonSubstitution(
   runId: string,
   input: { originalProductId: string; replacementProductId: string }
): Promise<void> {
   await request(`/comparisons/runs/${encodeURIComponent(runId)}/substitutions/dismiss`, {
      method: "POST",
      body: JSON.stringify(input),
   }, true);
}

export async function downloadComparisonCsv(runId: string, planId: string): Promise<void> {
   const token = await AsyncStorage.getItem("authToken");
   if (!token) throw new Error("Please log in to export a grocery comparison.");
   const response = await fetch(
      `${API_URL}/comparisons/runs/${encodeURIComponent(runId)}/export.csv?planId=${encodeURIComponent(planId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
   );
   if (!response.ok) throw new Error("The CSV export could not be created.");
   const csv = await response.text();
   if (Platform.OS !== "web" || typeof document === "undefined") return;
   const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
   const anchor = document.createElement("a");
   anchor.href = url;
   anchor.download = `discountmate-${runId}.csv`;
   anchor.click();
   URL.revokeObjectURL(url);
}

export async function startComparisonShopping(
   runId: string,
   planId: string
): Promise<ShoppingStartResult> {
   return request<ShoppingStartResult>(
      `/comparisons/runs/${encodeURIComponent(runId)}/start-shopping`,
      { method: "POST", body: JSON.stringify({ planId }) },
      true
   );
}

export async function fetchShoppingSession(sessionId: string): Promise<ShoppingSession> {
   return request<ShoppingSession>(
      `/comparisons/shopping-sessions/${encodeURIComponent(sessionId)}`,
      {},
      true
   );
}

export async function updateShoppingSessionItem(
   sessionId: string,
   itemId: string,
   checked: boolean
): Promise<ShoppingSession> {
   return request<ShoppingSession>(
      `/comparisons/shopping-sessions/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(itemId)}`,
      { method: "PATCH", body: JSON.stringify({ checked }) },
      true
   );
}

export async function trackComparisonEvents(
   events: { name: string; occurredAt?: string; properties?: Record<string, unknown>; anonymousSessionId?: string }[]
): Promise<void> {
   try {
      const anonymousSessionId = await getComparisonSessionId();
      await request("/comparisons/events", {
         method: "POST",
         body: JSON.stringify({
            events: events.map((event) => ({
               ...event,
               occurredAt: event.occurredAt || new Date().toISOString(),
               anonymousSessionId: event.anonymousSessionId || anonymousSessionId,
            })),
         }),
      }, "optional");
   } catch {
      // Tracking is best-effort and must never break the comparison experience.
   }
}

async function getComparisonSessionId(): Promise<string> {
   const storageKey = "comparisonAnonymousSessionId";
   const existing = await AsyncStorage.getItem(storageKey);
   if (existing) return existing;
   const generated = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
   });
   await AsyncStorage.setItem(storageKey, generated);
   return generated;
}
