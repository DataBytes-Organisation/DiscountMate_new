import React from "react";
import renderer, { act } from "react-test-renderer";
import { ScrollView } from "react-native";
import SpecialsScreen from "../specials";

jest.mock("@expo/vector-icons", () => ({
   Ionicons: "Ionicons",
   MaterialCommunityIcons: "MaterialCommunityIcons",
}));
jest.mock("../../../components/home/FooterSection", () => () => "Shared footer");
jest.mock("../../../components/home/ProductGrid", () => () => "Product grid");

test("Specials keeps the shared footer at the viewport bottom while content is short", () => {
   let tree: renderer.ReactTestRenderer;
   act(() => {
      tree = renderer.create(<SpecialsScreen />);
   });

   const scrollView = tree!.root.findByType(ScrollView);
   expect(scrollView.props.contentContainerStyle).toEqual(
      expect.objectContaining({ flexGrow: 1 })
   );
   expect(tree!.root.findByProps({ testID: "specials-page-content" }).props.style).toEqual(
      expect.objectContaining({ flexGrow: 1 })
   );
   expect(JSON.stringify(tree!.toJSON())).toContain("Shared footer");
});
