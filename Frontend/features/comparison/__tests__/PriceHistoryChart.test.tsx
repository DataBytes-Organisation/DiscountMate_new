import React from "react";
import renderer, { act } from "react-test-renderer";
import { PriceHistoryChart } from "../PriceHistoryChart";

describe("PriceHistoryChart", () => {
   it("draws a solid retailer-coloured baseline with visible start and end dates", () => {
      let tree: renderer.ReactTestRenderer;
      act(() => {
         tree = renderer.create(
            <PriceHistoryChart
               history={[{
                  retailerId: "aldi-id",
                  retailerName: "Aldi",
                  price: { amount: "2.49", currency: "AUD" },
                  observedAt: "2026-05-04T00:00:00.000Z",
               }]}
               forecasts={[{
                  retailerId: "aldi-id",
                  retailerName: "Aldi",
                  horizonDays: 14,
                  predictedPrice: { amount: "2.49", currency: "AUD" },
                  predictedChangePercent: 0,
                  forecastKind: "baseline",
                  baselineReason: "insufficient_history",
                  forecastAt: "2026-05-18T00:00:00.000Z",
                  basedOnObservedAt: "2026-05-04T00:00:00.000Z",
                  confidence: null,
                  confidenceLabel: null,
                  modelVersion: null,
               }]}
            />
         );
      });

      const retailerLines = tree!.root.findAll((node) => node.props.stroke === "#159447");
      expect(retailerLines.some((node) => node.props.strokeDasharray == null)).toBe(true);

      const text = JSON.stringify(tree!.toJSON());
      expect(text).toContain("4 May");
      expect(text).toContain("18 May");
      expect(text).not.toContain("observed 4 May 2026");
      expect(text).not.toContain("Dashed line = 14-day forecast");
   });
});
