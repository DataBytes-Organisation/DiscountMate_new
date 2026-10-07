jest.mock("@react-native-async-storage/async-storage", () => ({
   getItem: jest.fn(), setItem: jest.fn(),
}));

import { comparisonErrorMessage, normalizeProductComparison } from "../../../services/comparisons";

describe("comparison API errors", () => {
   it("turns stable backend codes into actionable grocery states", () => {
      expect(comparisonErrorMessage("no_mapped_items")).toContain("mapped");
      expect(comparisonErrorMessage("de_unavailable")).toContain("retailer data");
      expect(comparisonErrorMessage("app_database_unavailable")).toContain("save");
      expect(comparisonErrorMessage("authentication_required")).toContain("log in");
   });

   it("normalizes missing partial-service collections to safe empty arrays", () => {
      const comparison = normalizeProductComparison({
         history: null,
         forecasts: undefined,
         warnings: null,
         offers: undefined,
         unavailableRetailers: null,
      } as never);

      expect(comparison.history).toEqual([]);
      expect(comparison.forecasts).toEqual([]);
      expect(comparison.warnings).toEqual([]);
      expect(comparison.offers).toEqual([]);
      expect(comparison.unavailableRetailers).toEqual([]);
   });
});
