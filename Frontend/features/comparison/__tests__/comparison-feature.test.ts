import { isComparisonV2Enabled } from "../comparisonFeature";

describe("comparison frontend feature flag", () => {
   it("enables comparison only for an explicit true value", () => {
      expect(isComparisonV2Enabled(undefined)).toBe(false);
      expect(isComparisonV2Enabled("")).toBe(false);
      expect(isComparisonV2Enabled("false")).toBe(false);
      expect(isComparisonV2Enabled("true")).toBe(true);
   });
});
