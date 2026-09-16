import type {
   ComparisonWarning,
   ForecastResult,
   Money,
   PriceHistoryPoint,
} from "../../types/Comparison";

export function formatMoney(value: Money | null | undefined): string {
   if (!value) return "Unavailable";
   return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: value.currency,
   }).format(Number(value.amount));
}

export function formatRetailerName(value: string | null | undefined): string {
   const normalized = String(value || "").trim().toLowerCase();
   const names: Record<string, string> = {
      aldi: "ALDI",
      iga: "IGA",
      coles: "Coles",
      woolworths: "Woolworths",
   };
   if (names[normalized]) return names[normalized];
   return normalized.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatPack(quantity: string | null, unit: string | null): string {
   if (!quantity || !unit) return "Pack size unavailable";
   const value = Number(quantity);
   const normalizedUnit = unit.toLowerCase();
   if (normalizedUnit === "g" && value >= 1000) return `${trimNumber(value / 1000)} kg`;
   if (normalizedUnit === "ml" && value >= 1000) return `${trimNumber(value / 1000)} L`;
   return `${trimNumber(value)} ${unit}`;
}

export function getWarningCopy(code: string): string {
   const messages: Record<string, string> = {
      forecast_partial: "Forecast data is temporarily unavailable for some retailers.",
      incompatible_units: "Some prices use an incompatible unit or quantity and cannot be compared.",
      unresolved_products: "Some list products have not yet been mapped to the comparison catalogue.",
      missing_retailer_data: "Some products do not have a latest compatible retailer price.",
   };
   return messages[code] || "Some comparison data is temporarily unavailable.";
}

export function formatResolutionReason(reason: string | null | undefined): string {
   const messages: Record<string, string> = {
      duplicate_gtin: "Multiple catalogue products share this barcode",
      ambiguous_identity: "Multiple compatible catalogue matches need review",
      no_deterministic_match: "Not yet linked to the comparison catalogue",
      de_product_not_found: "The saved catalogue link is no longer available",
      missing_name: "This list item needs a product name",
   };
   return messages[String(reason || "")] || "Unavailable or not yet mapped";
}

export type ChartSeries = {
   retailerId: string;
   retailerName: string;
   points: { timestamp: string; value: number; forecast: boolean; forecastKind?: "model" | "baseline" }[];
};

export function buildChartSeries(
   history: PriceHistoryPoint[],
   forecasts: ForecastResult[]
): ChartSeries[] {
   const byRetailer = new Map<string, ChartSeries>();
   (Array.isArray(history) ? history : []).forEach((point) => {
      const timestamp = normalizeTimestamp(
         point?.observedAt ?? (point as PriceHistoryPoint & { observed_at?: string; timestamp?: string })?.observed_at
            ?? (point as PriceHistoryPoint & { timestamp?: string })?.timestamp
      );
      const value = Number(point?.price?.amount);
      if (!point?.retailerId || !timestamp || !Number.isFinite(value) || value <= 0) return;
      const series = byRetailer.get(point.retailerId) || {
         retailerId: point.retailerId,
         retailerName: point.retailerName,
         points: [],
      };
      series.points.push({
         timestamp,
         value,
         forecast: false,
      });
      byRetailer.set(point.retailerId, series);
   });
   (Array.isArray(forecasts) ? forecasts : []).forEach((forecast) => {
      const timestamp = normalizeTimestamp(
         forecast?.forecastAt ?? (forecast as ForecastResult & { forecast_at?: string; timestamp?: string })?.forecast_at
            ?? (forecast as ForecastResult & { timestamp?: string })?.timestamp
      );
      const value = Number(forecast?.predictedPrice?.amount);
      if (!forecast?.retailerId || !timestamp || !Number.isFinite(value) || value <= 0) return;
      const series = byRetailer.get(forecast.retailerId) || {
         retailerId: forecast.retailerId,
         retailerName: forecast.retailerName,
         points: [],
      };
      series.points.push({
         timestamp,
         value,
         forecast: true,
         forecastKind: forecast.forecastKind,
      });
      byRetailer.set(forecast.retailerId, series);
   });
   return Array.from(byRetailer.values()).map((series) => ({
      ...series,
      points: [...series.points].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
   }));
}

export function countValidObservationDays(
   history: Array<Pick<PriceHistoryPoint, "observedAt"> | { observedAt?: unknown }> | null | undefined
): number {
   const days = new Set<string>();
   (Array.isArray(history) ? history : []).forEach((point) => {
      const timestamp = normalizeTimestamp(point?.observedAt);
      if (timestamp) days.add(timestamp.slice(0, 10));
   });
   return days.size;
}

export function warningMessage(warning: ComparisonWarning): string {
   return warning.message || getWarningCopy(warning.code);
}

function trimNumber(value: number): string {
   return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function normalizeTimestamp(value: unknown): string | null {
   if (typeof value !== "string" && !(value instanceof Date)) return null;
   const parsed = new Date(value);
   return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}
