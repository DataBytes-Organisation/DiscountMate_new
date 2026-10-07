import React from "react";
import renderer, { act } from "react-test-renderer";
import { searchComparisonProducts } from "../../../services/comparisons";
import { useProductComparisonController } from "../useComparisonControllers";

jest.mock("@react-native-async-storage/async-storage", () => ({
   getItem: jest.fn(),
   setItem: jest.fn(),
}));

jest.mock("../../../services/comparisons", () => ({
   ...jest.requireActual("../../../services/comparisons"),
   searchComparisonProducts: jest.fn(),
   trackComparisonEvents: jest.fn().mockResolvedValue(undefined),
}));

const mockSearchComparisonProducts = searchComparisonProducts as jest.MockedFunction<typeof searchComparisonProducts>;

describe("product comparison search controller", () => {
   let controller: ReturnType<typeof useProductComparisonController>;

   function Harness() {
      controller = useProductComparisonController();
      return null;
   }

   beforeEach(() => {
      jest.useFakeTimers();
      mockSearchComparisonProducts.mockReset();
   });

   afterEach(() => {
      jest.useRealTimers();
   });

   it("exposes search failures instead of silently returning an empty result", async () => {
      mockSearchComparisonProducts.mockRejectedValue(new Error("Product search is temporarily unavailable."));

      act(() => {
         renderer.create(<Harness />);
      });
      act(() => {
         controller.setQuery("apple sauce");
      });
      await act(async () => {
         jest.advanceTimersByTime(250);
         await Promise.resolve();
      });

      expect(controller.results).toEqual([]);
      expect(controller.searchError).toBe("Product search is temporarily unavailable.");
      expect(controller.searchLoading).toBe(false);
   });

   it("retries the current search after a transient failure", async () => {
      mockSearchComparisonProducts
         .mockRejectedValueOnce(new Error("Temporary failure"))
         .mockResolvedValueOnce([]);

      act(() => {
         renderer.create(<Harness />);
      });
      act(() => {
         controller.setQuery("apple sauce");
      });
      await act(async () => {
         jest.advanceTimersByTime(250);
         await Promise.resolve();
      });

      act(() => {
         controller.retrySearch();
      });
      await act(async () => {
         jest.advanceTimersByTime(250);
         await Promise.resolve();
      });

      expect(mockSearchComparisonProducts).toHaveBeenCalledTimes(2);
      expect(controller.searchError).toBeNull();
   });
});
