import React from "react";
import renderer, { act } from "react-test-renderer";
import { ShoppingSessionView } from "../ShoppingSessionView";
import type { ShoppingSession } from "../../../types/Comparison";

jest.mock("react-native-vector-icons/FontAwesome6", () => "Icon");

const session: ShoppingSession = {
   id: "session-1",
   runId: "run-1",
   planId: "plan-1",
   status: "active",
   createdAt: "2026-08-22T00:00:00.000Z",
   groups: [{
      retailerName: "coles",
      retailerCapability: "product_page",
      items: [{
         lineItemId: "milk-line",
         productId: "milk",
         productName: "Full Cream Milk",
         imageUrl: null,
         quantity: 2,
         retailerId: "coles-id",
         retailerName: "coles",
         price: { amount: "3.49", currency: "AUD" },
         productUrl: "https://www.coles.com.au/product/1",
         retailerCapability: "product_page",
         linkStatus: "exact",
         observedAt: "2026-05-04T00:00:00.000Z",
         substitution: null,
         checked: false,
      }],
   }],
};

test("Shopping Mode preserves retailer groups, quantities, and checklist progress", () => {
   let tree: renderer.ReactTestRenderer;
   act(() => {
      tree = renderer.create(<ShoppingSessionView session={session} onToggle={jest.fn()} />);
   });
   const text = tree!.root.findAllByType("Text" as any).map((node) => node.props.children).flat(Infinity).join("");
   expect(text).toContain("Shopping Mode");
   expect(text).toContain("Full Cream Milk");
   expect(text).toContain("Qty 2");
   expect(text).toContain("0 of 1 collected");
   expect(text).toContain("Open next product");
   expect(text).toContain("Quantities are shown here for reference");
   expect(text).not.toContain("Preview automatic checkout");
});
