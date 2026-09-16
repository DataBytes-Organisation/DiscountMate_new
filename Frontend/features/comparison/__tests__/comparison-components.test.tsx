import React from "react";
import renderer, { act } from "react-test-renderer";
import { SingleProductComparison } from "../SingleProductComparison";

jest.mock("@react-native-async-storage/async-storage", () => ({
   getItem: jest.fn(),
   setItem: jest.fn(),
}));

const mockProductController = {
   query: "",
   setQuery: jest.fn(),
   results: [],
   selectedProduct: null,
   comparison: null,
   range: "3m",
   includeSimilar: true,
   retailerIds: [],
   availableRetailers: [],
   loading: false,
   error: null,
   selectProduct: jest.fn(),
   changeRange: jest.fn(),
   toggleSimilar: jest.fn(),
   toggleRetailer: jest.fn(),
   clearRetailers: jest.fn(),
   clear: jest.fn(),
   retry: jest.fn(),
};
const mockToastShow = jest.fn();
const mockShoppingLists = {
   activeListId: null as string | null,
   addItemToActiveList: jest.fn(),
};

jest.mock("../useComparisonControllers", () => ({
   useProductComparisonController: () => mockProductController,
}));
jest.mock("../../../app/(tabs)/ShoppingListsContext", () => ({
   useShoppingLists: () => mockShoppingLists,
}));
jest.mock("react-native-toast-notifications", () => ({
   useToast: () => ({ show: mockToastShow }),
}));
jest.mock("../../../components/layout/ProductImageScanner", () => ({
   ProductImageScanner: () => "Shared product scanner",
}), { virtual: true });

jest.mock("react-native-vector-icons/FontAwesome6", () => "Icon");

describe("comparison components", () => {
   it("renders a useful single-product discovery state with the shared scanner", () => {
      let tree: renderer.ReactTestRenderer;
      act(() => {
         tree = renderer.create(<SingleProductComparison />);
      });
      const text = JSON.stringify(tree!.toJSON());
      expect(text).toContain("Find the best price before you shop");
      expect(text).toContain("Shared product scanner");
      expect(text).toContain("Compare four retailers");
      expect(text).toContain("Popular searches");
      expect(text).toContain("Apple Sauce");
      expect(text).not.toContain("Scan unavailable");
      expect(text).not.toContain("Regular price");
      expect(text).not.toContain("Healthier alternatives");
      expect(text).not.toContain("Alert");
   });

   it("shows retailer coverage on product search suggestions", () => {
      Object.assign(mockProductController, {
         query: "lettuce",
         results: [{
            id: "11111111-1111-4111-8111-111111111111",
            comparisonProductId: "11111111-1111-4111-8111-111111111111",
            sourceProductId: "22222222-2222-4222-8222-222222222222",
            name: "Macro Fresh Lettuce",
            brand: "Macro",
            categoryName: "Fruit and vegetables",
            packQuantity: "1",
            packUom: "ea",
            imageUrl: null,
            availableRetailers: [{ retailerId: "woolworths-id", retailerName: "woolworths" }],
            offerCount: 1,
         }],
         selectedProduct: null,
         comparison: null,
      });

      let tree: renderer.ReactTestRenderer;
      act(() => { tree = renderer.create(<SingleProductComparison />); });
      const text = JSON.stringify(tree!.toJSON());
      const visibleText = tree!.root.findAllByType("Text" as any)
         .map((node) => node.props.children).flat(Infinity).join("");

      expect(text).toContain("Macro Fresh Lettuce");
      expect(text).toContain("Woolworths retailer");
      expect(visibleText).toContain("1 current offer");

      Object.assign(mockProductController, { query: "", results: [] });
   });

   it("fixes price history to three months while presenting a 14-day outlook", () => {
      const product = {
         id: "11111111-1111-4111-8111-111111111111",
         name: "Milk",
         brand: "Demo",
         categoryName: "Dairy",
         packQuantity: "2",
         packUom: "L",
         imageUrl: null,
      };
      Object.assign(mockProductController, {
         selectedProduct: product,
         comparison: {
            product,
            offers: [],
            unavailableRetailers: [],
            excludedOffers: [],
            cheapest: null,
            history: [],
            historyObservationDays: 0,
            forecasts: [],
            advice: { type: "monitor", title: "Monitor", reason: "There is not enough verified evidence to recommend buying now or waiting." },
            alternatives: { sameProductOtherSizes: [], similarProducts: [] },
            dataWatermark: "2026-05-04T00:00:00.000Z",
            calculationPolicyVersion: "comparison-v2.2",
            warnings: [],
         },
      });

      let tree: renderer.ReactTestRenderer;
      act(() => { tree = renderer.create(<SingleProductComparison />); });
      const text = JSON.stringify(tree!.toJSON());

      expect(mockProductController.range).toBe("3m");
      expect(text).toContain("Price history and 14-day outlook");
      expect(text).toContain("Latest available prices and a 14-day price outlook.");
      expect(text).toContain("Compare current offers");
      expect(text).toContain("No compatible current offers are available.");
      expect(text).not.toContain("Monitor");
      expect(text).not.toContain("There is not enough verified evidence");
      expect(text).not.toContain('"4w"');
      expect(text).not.toContain('"6m"');
      expect(text).not.toContain('"1y"');
      expect(text).not.toContain("Policy comparison-v2.2");

      Object.assign(mockProductController, { selectedProduct: null, comparison: null });
   });

   it("keeps search visible and presents one-day data as one concise snapshot outlook", () => {
      const product = {
         id: "11111111-1111-4111-8111-111111111111", name: "Milk", brand: "Demo",
         categoryName: "Dairy", packQuantity: "2", packUom: "L", imageUrl: null,
      };
      Object.assign(mockProductController, {
         selectedProduct: product,
         comparison: {
            product, offers: [], unavailableRetailers: [], excludedOffers: [], cheapest: null,
            history: [{ retailerId: "retailer-1", retailerName: "Coles", price: { amount: "3.49", currency: "AUD" }, observedAt: "2026-05-04T00:00:00.000Z" }],
            historyObservationDays: 1,
            forecasts: [{
               retailerId: "retailer-1", retailerName: "Coles", horizonDays: 14,
               predictedPrice: { amount: "3.49", currency: "AUD" }, predictedChangePercent: 0,
               forecastKind: "baseline", forecastAt: "2026-05-18T00:00:00.000Z",
               baselineReason: "insufficient_history",
               basedOnObservedAt: "2026-05-04T00:00:00.000Z", confidence: null,
               confidenceLabel: null, modelVersion: null,
            }],
            advice: { type: "monitor", title: "Monitor", reason: "More data is needed." },
            alternatives: { sameProductOtherSizes: [], similarProducts: [] },
            dataWatermark: "2026-05-04T00:00:00.000Z", calculationPolicyVersion: "comparison-v2.2", warnings: [],
         },
      });

      let tree: renderer.ReactTestRenderer;
      act(() => { tree = renderer.create(<SingleProductComparison />); });
      const text = JSON.stringify(tree!.toJSON());

      expect(tree!.root.findByProps({ accessibilityLabel: "Search for a product to compare" })).toBeTruthy();
      expect(text).toContain("Snapshot-based outlook");
      expect(text).toContain("Prices are shown as unchanged over the next 14 days based on the latest snapshot.");
      expect(text).not.toContain("Only one observation day is available");
      expect(text).not.toContain("Baseline estimate");
      expect(text).not.toContain("observed 4 May 2026");
      expect(text).not.toContain("Medium (58%)");
      expect(text).not.toContain("Policy comparison-v2.2");

      Object.assign(mockProductController, { selectedProduct: null, comparison: null });
   });

   it("waits for list persistence and confirms a successful add", async () => {
      const product = {
         id: "11111111-1111-4111-8111-111111111111", name: "Milk", brand: "Demo",
         categoryName: "Dairy", packQuantity: "2", packUom: "L", imageUrl: null,
      };
      mockShoppingLists.activeListId = "list-1";
      mockShoppingLists.addItemToActiveList.mockResolvedValue({ action: "added" });
      Object.assign(mockProductController, {
         selectedProduct: product,
         comparison: {
            product,
            offers: [], unavailableRetailers: [], excludedOffers: [],
            cheapest: { retailerId: "retailer-1", retailerName: "Coles", price: { amount: "3.49", currency: "AUD" }, unitPrice: "1.75" },
            history: [], historyObservationDays: 0, forecasts: [],
            advice: { type: "monitor", title: "Monitor", reason: "More data is needed." },
            alternatives: { sameProductOtherSizes: [], similarProducts: [] },
            dataWatermark: null, calculationPolicyVersion: "comparison-v2.2", warnings: [],
         },
      });
      let tree: renderer.ReactTestRenderer;
      act(() => { tree = renderer.create(<SingleProductComparison />); });

      await act(async () => {
         tree!.root.findByProps({ accessibilityLabel: "Add to grocery list" }).props.onPress();
      });

      expect(mockShoppingLists.addItemToActiveList).toHaveBeenCalled();
      expect(mockToastShow).toHaveBeenCalledWith("Added to Grocery List successfully.", expect.objectContaining({ type: "success" }));

      mockShoppingLists.activeListId = null;
      Object.assign(mockProductController, { selectedProduct: null, comparison: null });
   });
});
