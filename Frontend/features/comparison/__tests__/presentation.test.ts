import {
   buildChartSeries,
   countValidObservationDays,
   formatMoney,
   formatPack,
   formatResolutionReason,
   getWarningCopy,
   formatRetailerName,
} from "../presentation";

describe("comparison presentation", () => {
   it("formats AUD money and normalized packs", () => {
      expect(formatMoney({ amount: "3.49", currency: "AUD" })).toBe("$3.49");
      expect(formatPack("1000", "g")).toBe("1 kg");
      expect(formatPack("2", "L")).toBe("2 L");
   });

   it("adds a single forecast point after retailer history", () => {
      const series = buildChartSeries(
         [{
            retailerId: "retailer-1",
            retailerName: "Aldi",
            price: { amount: "3.49", currency: "AUD" },
            observedAt: "2026-08-20T00:00:00.000Z",
         }],
         [{
            retailerId: "retailer-1",
            retailerName: "Aldi",
            horizonDays: 14,
            predictedPrice: { amount: "3.20", currency: "AUD" },
            predictedChangePercent: -8.3,
            confidence: 0.75,
            confidenceLabel: "High",
            modelVersion: "moving-average-v1",
            forecastKind: "model",
            baselineReason: null,
            forecastAt: "2026-09-03T12:00:00.000Z",
            basedOnObservedAt: "2026-08-20T00:00:00.000Z",
         }]
      );

      expect(series[0].points).toHaveLength(2);
      expect(series[0].points[1]).toMatchObject({ forecast: true, forecastKind: "model", value: 3.2 });
      expect(series[0].points[1].timestamp).toBe("2026-09-03T12:00:00.000Z");
   });

   it("ignores malformed chart entries while preserving valid history", () => {
      const series = buildChartSeries(
         [
            {
               retailerId: "retailer-1",
               retailerName: "Coles",
               price: { amount: "3.60", currency: "AUD" },
               observedAt: "2026-05-04T00:00:00.000Z",
            },
            {
               retailerId: "retailer-1",
               retailerName: "Coles",
               price: { amount: "3.70", currency: "AUD" },
               observedAt: undefined,
            } as never,
            {
               retailerId: "retailer-2",
               retailerName: "IGA",
               price: { amount: "not-a-price", currency: "AUD" },
               observedAt: "not-a-date",
            },
         ],
         [{
            retailerId: "retailer-1",
            retailerName: "Coles",
            horizonDays: 14,
            predictedPrice: { amount: "3.60", currency: "AUD" },
            predictedChangePercent: 0,
            confidence: null,
            confidenceLabel: null,
            modelVersion: null,
            forecastKind: "baseline",
            baselineReason: "insufficient_history",
            forecastAt: undefined,
            basedOnObservedAt: "2026-05-04T00:00:00.000Z",
         } as never]
      );

      expect(series).toHaveLength(1);
      expect(series[0].points).toEqual([{
         timestamp: "2026-05-04T00:00:00.000Z",
         value: 3.6,
         forecast: false,
      }]);
   });

   it("counts only valid distinct observation days", () => {
      expect(countValidObservationDays([
         { observedAt: "2026-05-04T01:00:00.000Z" },
         { observedAt: "2026-05-04T20:00:00.000Z" },
         { observedAt: "2026-05-05T01:00:00.000Z" },
         { observedAt: undefined },
         { observedAt: "not-a-date" },
      ] as never)).toBe(2);
   });

   it("provides clear fallback copy for partial sections", () => {
      expect(getWarningCopy("forecast_partial")).toContain("Forecast");
      expect(getWarningCopy("incompatible_units")).toContain("unit");
   });

   it("explains why a saved-list line could not be linked to Silver", () => {
      expect(formatResolutionReason("duplicate_gtin")).toBe("Multiple catalogue products share this barcode");
      expect(formatResolutionReason("ambiguous_identity")).toBe("Multiple compatible catalogue matches need review");
      expect(formatResolutionReason("no_deterministic_match")).toBe("Not yet linked to the comparison catalogue");
   });

   it("normalizes retailer names for display", () => {
      expect(formatRetailerName("aldi")).toBe("ALDI");
      expect(formatRetailerName("iga")).toBe("IGA");
      expect(formatRetailerName("woolworths")).toBe("Woolworths");
      expect(formatRetailerName("coles")).toBe("Coles");
   });
});
