/**
 * @jest-environment jsdom
 */
import React from "react";
import renderer, { act } from "react-test-renderer";
import { Platform, Pressable, Text } from "react-native";

const mockPromptAsync = jest.fn();
const mockReplace = jest.fn();
const mockRefreshProfile = jest.fn();
const mockSetItem = jest.fn();
let mockAuthResponse: unknown = null;
let mockAuthRequest: { state: string } | null = { state: "expected-state" };

jest.mock("expo-auth-session/providers/google", () => ({
   useIdTokenAuthRequest: jest.fn(() => [mockAuthRequest, mockAuthResponse, mockPromptAsync]),
}));
jest.mock("expo-web-browser", () => ({
   maybeCompleteAuthSession: jest.fn(),
}));
jest.mock("expo-router", () => ({
   useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
   setItem: (...args: unknown[]) => mockSetItem(...args),
}));
jest.mock("../../../context/UserProfileContext", () => ({
   useUserProfile: () => ({ refreshProfile: mockRefreshProfile }),
}));

/* eslint-disable import/first -- mocks depend on the initialized test doubles above */
import GoogleSignInButton from "../GoogleSignInButton";
import { getGoogleClientConfiguration } from "../../../services/googleAuth";
import * as Google from "expo-auth-session/providers/google";
/* eslint-enable import/first */

const configuredClientEnvironment = {
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "web-client-id",
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: "ios-client-id",
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: "android-client-id",
};

function setBrowserUrl(path: string) {
   const url = new URL(path, "http://localhost:8081");
   Object.defineProperty(window, "location", {
      configurable: true,
      value: {
         href: url.href,
         pathname: url.pathname,
         search: url.search,
         hash: url.hash,
      },
   });
}

function GoogleButton(props: React.ComponentProps<typeof GoogleSignInButton> = {}) {
   return (
      <GoogleSignInButton
         clientEnvironment={configuredClientEnvironment}
         {...props}
      />
   );
}

describe("GoogleSignInButton", () => {
   beforeEach(() => {
      jest.clearAllMocks();
      mockAuthResponse = null;
      mockAuthRequest = { state: "expected-state" };
      window.sessionStorage.clear();
      Object.defineProperty(window, "history", {
         configurable: true,
         value: {
            state: null,
            replaceState: jest.fn((_state, _title, path: string) => {
               setBrowserUrl(path);
            }),
         },
      });
      setBrowserUrl("/login");
      (global as any).fetch = jest.fn(async () => ({
         ok: true,
         status: 200,
         json: async () => ({
            message: "Signin successful",
            token: "discountmate-jwt",
            role: "user",
            admin: false,
         }),
      }));
   });

   test("exchanges a successful Google credential and completes the DiscountMate session", async () => {
      mockPromptAsync.mockResolvedValue({
         type: "success",
         params: { id_token: "signed-google-token" },
      });
      const onBusyChange = jest.fn();
      const onError = jest.fn();
      const component = renderer.create(
         <GoogleButton onBusyChange={onBusyChange} onError={onError} />
      );

      await act(async () => {
         await component.root.findByType(Pressable).props.onPress();
      });

      expect(global.fetch).toHaveBeenCalledWith(
         "http://localhost:3000/api/users/auth/google",
         expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ idToken: "signed-google-token" }),
         })
      );
      expect(mockSetItem).toHaveBeenCalledWith("authToken", "discountmate-jwt");
      expect(mockRefreshProfile).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
      expect(onBusyChange).toHaveBeenNthCalledWith(1, true);
      expect(onBusyChange).toHaveBeenLastCalledWith(false);
      expect(onError).toHaveBeenCalledWith(null);
   });

   test("recovers a same-tab web callback after the OAuth page reloads the app", async () => {
      window.sessionStorage.setItem(
         "discountmate.googleOAuthState",
         "expected-state"
      );
      setBrowserUrl("/login#state=expected-state&id_token=same-tab-google-token");

      await act(async () => {
         renderer.create(<GoogleButton />);
         await Promise.resolve();
      });

      expect(global.fetch).toHaveBeenCalledWith(
         "http://localhost:3000/api/users/auth/google",
         expect.objectContaining({
            body: JSON.stringify({ idToken: "same-tab-google-token" }),
         })
      );
      expect(mockSetItem).toHaveBeenCalledWith("authToken", "discountmate-jwt");
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
      expect(window.location.hash).toBe("");
   });

   test("rejects a same-tab callback whose OAuth state does not match", async () => {
      window.sessionStorage.setItem(
         "discountmate.googleOAuthState",
         "expected-state"
      );
      setBrowserUrl("/login#state=wrong-state&id_token=untrusted-google-token");
      const onError = jest.fn();

      await act(async () => {
         renderer.create(<GoogleButton onError={onError} />);
         await Promise.resolve();
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockSetItem).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
         "Your Google identity could not be verified. Please try signing in again."
      );
      expect(window.location.hash).toBe("");
   });

   test("requests only identity scopes and uses the registered callbacks", () => {
      renderer.create(<GoogleButton />);

      expect(Google.useIdTokenAuthRequest).toHaveBeenCalledWith(
         expect.objectContaining({ scopes: ["openid", "email", "profile"] }),
         {
            native: "com.discountmate.app:/oauthredirect",
            path: "login",
         }
      );
   });

   test("cancellation does not contact DiscountMate", async () => {
      mockPromptAsync.mockResolvedValue({ type: "cancel" });
      const component = renderer.create(<GoogleButton />);

      await act(async () => {
         await component.root.findByType(Pressable).props.onPress();
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockSetItem).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
   });

   test("waits for Expo's completed native token exchange", async () => {
      mockPromptAsync.mockResolvedValue({
         type: "success",
         params: { code: "native-authorization-code" },
      });
      const component = renderer.create(<GoogleButton />);

      await act(async () => {
         await component.root.findByType(Pressable).props.onPress();
      });
      expect(global.fetch).not.toHaveBeenCalled();

      mockAuthResponse = {
         type: "success",
         params: { id_token: "native-google-id-token" },
      };
      await act(async () => {
         component.update(<GoogleButton />);
      });

      expect(global.fetch).toHaveBeenCalledWith(
         "http://localhost:3000/api/users/auth/google",
         expect.objectContaining({
            body: JSON.stringify({ idToken: "native-google-id-token" }),
         })
      );
   });

   test("repeated presses while the prompt is open create one authentication request", async () => {
      let finishPrompt: (result: unknown) => void = () => undefined;
      mockPromptAsync.mockImplementation(() => new Promise((resolve) => {
         finishPrompt = resolve;
      }));
      const component = renderer.create(<GoogleButton />);
      const onPress = component.root.findByType(Pressable).props.onPress;

      let firstPress: Promise<void>;
      await act(async () => {
         firstPress = onPress();
         await onPress();
      });
      expect(mockPromptAsync).toHaveBeenCalledTimes(1);

      await act(async () => {
         finishPrompt({ type: "cancel" });
         await firstPress!;
      });
   });

   test("missing configuration renders a disabled controlled state", () => {
      expect(getGoogleClientConfiguration(Platform.OS, {})).toEqual({
         configured: false,
         clientId: "",
      });

      const component = renderer.create(
         <GoogleSignInButton clientEnvironment={{}} />
      );

      expect(component.root.findByType(Pressable).props.disabled).toBe(true);
      expect(component.root.findAllByType(Text).some((node) => (
         String(node.props.children).includes("not configured")
      ))).toBe(true);
   });
});
