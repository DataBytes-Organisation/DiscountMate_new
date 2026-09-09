import React from "react";
import renderer, { act } from "react-test-renderer";
import CompareScreen from "../../../app/(tabs)/compare";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../../../app/(tabs)/ShoppingListsContext", () => ({
   useShoppingLists: () => ({ lists: [], activeListId: null, isAuthenticated: false }),
}));
jest.mock("../GroceryListComparison", () => ({ GroceryListComparison: () => "Grocery comparison content" }));
jest.mock("../SingleProductComparison", () => ({ SingleProductComparison: () => "Single comparison content" }));
jest.mock("react-native-vector-icons/FontAwesome6", () => "Icon");
jest.mock("../../../components/home/FooterSection", () => () => "Shared footer");

describe("comparison page", () => {
   it("shows public Single Product first and switches to Grocery List", () => {
      let tree: renderer.ReactTestRenderer;
      act(() => {
         tree = renderer.create(<CompareScreen />);
      });
      expect(JSON.stringify(tree!.toJSON())).toContain("Single comparison content");
      const groceryTab = tree!.root.findByProps({ accessibilityLabel: "Grocery List" });
      act(() => groceryTab.props.onPress());
      expect(JSON.stringify(tree!.toJSON())).toContain("Grocery comparison content");
   });

   it("preserves the Power BI entry point and omits Share", () => {
      let tree: renderer.ReactTestRenderer;
      act(() => {
         tree = renderer.create(<CompareScreen />);
      });
      const text = JSON.stringify(tree!.toJSON());
      expect(text).toContain("View Power BI Report");
      expect(text.match(/Shared footer/g)).toHaveLength(1);
      expect(text).not.toContain('"Share"');
   });
});
