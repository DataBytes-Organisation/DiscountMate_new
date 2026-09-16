import React from "react";
import { Image } from "react-native";
import renderer, { act } from "react-test-renderer";
import { RetailerBadge } from "../RetailerBadge";

test.each(["aldi", "coles", "woolworths", "iga"])(
   "renders the local %s retailer logo",
   (retailer) => {
      let tree: renderer.ReactTestRenderer;
      act(() => { tree = renderer.create(<RetailerBadge name={retailer} />); });

      expect(tree!.root.findAllByType("Image" as any)).toHaveLength(1);
   }
);

test("keeps the text badge fallback for an unknown retailer", () => {
   let tree: renderer.ReactTestRenderer;
   act(() => { tree = renderer.create(<RetailerBadge name="Local Market" />); });

   expect(tree!.root.findAllByType("Image" as any)).toHaveLength(0);
   expect(JSON.stringify(tree!.toJSON())).toContain("LO");
});

test("renders the red Coles wordmark on a neutral background", () => {
   let tree: renderer.ReactTestRenderer;
   act(() => { tree = renderer.create(<RetailerBadge name="Coles" />); });

   const logo = tree!.root.findByType(Image);
   expect(logo.parent?.props.style).toMatchObject({
      backgroundColor: "#FFFFFF",
      padding: 2,
   });
});
