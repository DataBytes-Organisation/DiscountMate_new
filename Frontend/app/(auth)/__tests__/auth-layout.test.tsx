import React from "react";
import renderer from "react-test-renderer";
import { ScrollView } from "react-native";

jest.mock("expo-router", () => ({
   Slot: () => {
      const MockView = require("react-native").View;
      return <MockView testID="auth-screen" />;
   },
}));

/* eslint-disable import/first -- the route dependency must be mocked first */
import AuthLayout from "../_layout";
/* eslint-enable import/first */

describe("authentication layout", () => {
   test("leaves scrolling to the active authentication screen", () => {
      const component = renderer.create(<AuthLayout />);

      expect(component.root.findAllByType(ScrollView)).toHaveLength(0);
   });
});
