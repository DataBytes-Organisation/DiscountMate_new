import React from "react";
import renderer from "react-test-renderer";
import { Text } from "react-native";

jest.mock("expo-router", () => ({
   useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
   useLocalSearchParams: () => ({}),
}));
jest.mock("react-native-vector-icons/FontAwesome6", () => "Icon");
jest.mock("react-native-vector-icons/Ionicons", () => "Icon");
jest.mock("@react-native-async-storage/async-storage", () => ({
   setItem: jest.fn(),
}));
jest.mock("../../../components/auth/GoogleSignInButton", () => {
   const MockText = require("react-native").Text;
   return function MockGoogleSignInButton({ label = "Google" }: { label?: string }) {
      return <MockText>{label}</MockText>;
   };
});
jest.mock("../../../context/UserProfileContext", () => ({
   useUserProfile: () => ({ refreshProfile: jest.fn() }),
}));

/* eslint-disable import/first -- mocks must initialize before route modules */
import LoginPage from "../login";
import RegisterScreen from "../register";
/* eslint-enable import/first */

function renderedText(component: React.ReactElement): string[] {
   return renderer.create(component).root.findAllByType(Text).map((node) => (
      String(node.props.children)
   ));
}

describe("Google authentication entry points", () => {
   test("login offers Google sign-in", () => {
      expect(renderedText(<LoginPage />)).toContain("Google");
   });

   test("login does not offer Facebook authentication", () => {
      expect(renderedText(<LoginPage />)).not.toContain("Facebook");
   });

   test("registration offers passwordless Google account creation", () => {
      expect(renderedText(<RegisterScreen />)).toContain("Continue with Google");
   });

   test.each([
      ["login", <LoginPage />],
      ["registration", <RegisterScreen />],
   ])("%s uses the complete landing-page footer", (_name, screen) => {
      const text = renderedText(screen);

      expect(text).toContain("Quick Links");
      expect(text).toContain("Support");
      expect(text).toContain("Newsletter");
   });
});
