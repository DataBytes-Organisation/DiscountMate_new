import React from "react";
import renderer, { act } from "react-test-renderer";
import { GroceryListComparison } from "../GroceryListComparison";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@react-native-async-storage/async-storage", () => ({
   getItem: jest.fn(), setItem: jest.fn(),
}));
jest.mock("../../../app/(tabs)/ShoppingListsContext", () => ({
   useShoppingLists: () => ({
      lists: [], activeListId: null, isLoading: false, isAuthenticated: false,
      setActiveList: jest.fn(), updateListItemQuantity: jest.fn(),
   }),
}));
jest.mock("../useComparisonControllers", () => ({
   useGroceryComparisonController: () => ({
      objective: "lowest_total", maxRetailers: 2, allowStoreBrandSubstitutions: true,
      run: null, loading: false, error: null, execute: jest.fn(), clear: jest.fn(),
      setRun: jest.fn(), setObjective: jest.fn(), setMaxRetailers: jest.fn(),
      setAllowStoreBrandSubstitutions: jest.fn(),
   }),
}));
jest.mock("react-native-vector-icons/FontAwesome6", () => "Icon");

test("Grocery List comparison asks anonymous visitors to sign in", () => {
   let tree: renderer.ReactTestRenderer;
   act(() => { tree = renderer.create(<GroceryListComparison />); });
   const text = JSON.stringify(tree!.toJSON());
   expect(text).toContain("Sign in to compare your grocery list");
   expect(text).toContain("Create account");
});
