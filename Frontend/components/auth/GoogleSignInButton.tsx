import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSessionResult } from "expo-auth-session";
import { useRouter } from "expo-router";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

import { useUserProfile } from "../../context/UserProfileContext";
import {
   GoogleSignInError,
   GoogleClientEnvironment,
   clearGoogleWebAuthState,
   consumeGoogleWebAuthCallback,
   exchangeGoogleIdToken,
   getGoogleClientConfiguration,
   googleSignInErrorMessage,
   rememberGoogleWebAuthState,
   storeDiscountMateSession,
} from "../../services/googleAuth";

WebBrowser.maybeCompleteAuthSession();

type GoogleSignInButtonProps = {
   disabled?: boolean;
   label?: string;
   onBusyChange?: (busy: boolean) => void;
   onError?: (message: string | null) => void;
   clientEnvironment?: GoogleClientEnvironment;
};

const buildTimeGoogleClientEnvironment: GoogleClientEnvironment = {
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};

function ConfiguredGoogleSignInButton({
   disabled = false,
   label = "Google",
   onBusyChange,
   onError,
   clientEnvironment = buildTimeGoogleClientEnvironment,
}: GoogleSignInButtonProps) {
   const router = useRouter();
   const { refreshProfile } = useUserProfile();
   const [busy, setBusy] = useState(false);
   const [internalError, setInternalError] = useState<string | null>(null);
   const busyRef = useRef(false);
   const completionRef = useRef(false);
   const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
      {
         webClientId: clientEnvironment.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
         iosClientId: clientEnvironment.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
         androidClientId: clientEnvironment.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
         scopes: ["openid", "email", "profile"],
         selectAccount: true,
      },
      { native: "com.discountmate.app:/oauthredirect", path: "login" }
   );

   const reportError = useCallback((error: unknown) => {
      const message = googleSignInErrorMessage(error);
      setInternalError(message);
      onError?.(message);
   }, [onError]);

   const setAuthenticationBusy = useCallback((nextBusy: boolean) => {
      busyRef.current = nextBusy;
      setBusy(nextBusy);
      onBusyChange?.(nextBusy);
   }, [onBusyChange]);

   const clearPendingWebAuthentication = useCallback(() => {
      if (typeof window !== "undefined" && window.sessionStorage) {
         clearGoogleWebAuthState(window.sessionStorage);
      }
   }, []);

   const completeDiscountMateSignIn = useCallback(async (idToken: string) => {
      if (completionRef.current) return;

      completionRef.current = true;
      try {
         const session = await exchangeGoogleIdToken(idToken);
         await storeDiscountMateSession(session, AsyncStorage);
         await refreshProfile();
         router.replace("/(tabs)");
      } catch (error) {
         if (
            !(error instanceof GoogleSignInError) &&
            /popup|blocked/i.test(String((error as Error)?.message || error))
         ) {
            reportError(new GoogleSignInError("popup_blocked", 0, "Popup blocked"));
         } else {
            reportError(error);
         }
      } finally {
         clearPendingWebAuthentication();
         setAuthenticationBusy(false);
      }
   }, [
      clearPendingWebAuthentication,
      refreshProfile,
      reportError,
      router,
      setAuthenticationBusy,
   ]);

   const handleAuthResult = useCallback(async (result: AuthSessionResult | null) => {
      if (!result) return;

      if (result.type === "cancel" || result.type === "dismiss") {
         clearPendingWebAuthentication();
         setAuthenticationBusy(false);
         return;
      }
      if (result.type !== "success") {
         reportError(new GoogleSignInError(
            result.type === "locked" ? "popup_blocked" : "provider_error",
            0,
            "Google did not complete sign-in"
         ));
         clearPendingWebAuthentication();
         setAuthenticationBusy(false);
         return;
      }

      const idToken = String(
         result.params?.id_token || result.authentication?.idToken || ""
      );

      // Native AuthSession first returns an authorization code. Its response
      // state is updated with an ID token after Expo completes the code exchange.
      if (!idToken) return;

      await completeDiscountMateSignIn(idToken);
   }, [
      clearPendingWebAuthentication,
      completeDiscountMateSignIn,
      reportError,
      setAuthenticationBusy,
   ]);

   useEffect(() => {
      if (
         typeof window === "undefined" ||
         !window.location?.href ||
         !window.sessionStorage
      ) {
         return;
      }

      let callback;
      try {
         callback = consumeGoogleWebAuthCallback(
            window.location.href,
            window.sessionStorage
         );
      } catch (error) {
         window.history?.replaceState(
            window.history.state,
            "",
            `${window.location.pathname}${window.location.search}`
         );
         reportError(error);
         return;
      }

      if (!callback) return;

      window.history?.replaceState(
         window.history.state,
         "",
         `${window.location.pathname}${window.location.search}`
      );

      if (callback.type === "cancel") {
         setAuthenticationBusy(false);
         return;
      }

      completionRef.current = false;
      setInternalError(null);
      onError?.(null);
      setAuthenticationBusy(true);
      void completeDiscountMateSignIn(callback.idToken);
   }, [completeDiscountMateSignIn, onError, reportError, setAuthenticationBusy]);

   useEffect(() => {
      void handleAuthResult(response);
   }, [handleAuthResult, response]);

   useEffect(() => {
      if (!busy) return undefined;

      const timeout = setTimeout(() => {
         if (busyRef.current && !completionRef.current) {
            reportError(new GoogleSignInError(
               "authentication_unavailable",
               503,
               "Google did not finish authentication"
            ));
            setAuthenticationBusy(false);
         }
      }, 30_000);

      return () => clearTimeout(timeout);
   }, [busy, reportError, setAuthenticationBusy]);

   const handleGoogleSignIn = async () => {
      if (busyRef.current || disabled || !request) return;

      completionRef.current = false;
      setAuthenticationBusy(true);
      setInternalError(null);
      onError?.(null);

      if (
         typeof window !== "undefined" &&
         window.sessionStorage &&
         typeof request.state === "string"
      ) {
         rememberGoogleWebAuthState(request.state, window.sessionStorage);
      }

      try {
         const result = await promptAsync();
         await handleAuthResult(result);
      } catch (error) {
         if (
            !(error instanceof GoogleSignInError) &&
            /popup|blocked/i.test(String((error as Error)?.message || error))
         ) {
            reportError(new GoogleSignInError("popup_blocked", 0, "Popup blocked"));
         } else {
            reportError(error);
         }
         clearPendingWebAuthentication();
         setAuthenticationBusy(false);
      }
   };

   const unavailable = !request;

   return (
      <View className="flex-1">
         <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            className={`flex-row items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 bg-white ${busy || disabled || unavailable ? "opacity-60" : ""}`}
            disabled={busy || disabled || unavailable}
            onPress={handleGoogleSignIn}
         >
            {busy ? (
               <ActivityIndicator color="#DB4437" />
            ) : (
               <>
                  <FontAwesome6 name="google" size={18} color="#DB4437" />
                  <Text className="text-sm font-semibold text-gray-800">{label}</Text>
               </>
            )}
         </Pressable>
         {internalError && !onError ? (
            <Text className="mt-2 text-sm text-red-500">{internalError}</Text>
         ) : null}
      </View>
   );
}

export default function GoogleSignInButton(props: GoogleSignInButtonProps) {
   const clientEnvironment = props.clientEnvironment || buildTimeGoogleClientEnvironment;
   const configuration = getGoogleClientConfiguration(Platform.OS, clientEnvironment);

   if (!configuration.configured) {
      return (
         <View className="flex-1">
            <Pressable
               accessibilityRole="button"
               accessibilityLabel={props.label || "Google"}
               className="flex-row items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 bg-white opacity-60"
               disabled
            >
               <FontAwesome6 name="google" size={18} color="#DB4437" />
               <Text className="text-sm font-semibold text-gray-800">
                  {props.label || "Google"}
               </Text>
            </Pressable>
            <Text className="mt-2 text-xs text-gray-500">
               Google sign-in is not configured for this build.
            </Text>
         </View>
      );
   }

   return (
      <ConfiguredGoogleSignInButton
         {...props}
         clientEnvironment={clientEnvironment}
      />
   );
}
