import { useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { API_URL } from "../constants/Api";

const PUSH_TOKEN_KEY = "registeredPushToken";

async function sendPushToken(method: "POST" | "DELETE", body: Record<string, string>) {
   const authToken = await AsyncStorage.getItem("authToken");
   if (!authToken) {
      return false;
   }

   const response = await fetch(`${API_URL}/users/push-token`, {
      method,
      headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
   });

   return response.ok;
}

async function registerPushToken() {
   if (Platform.OS === "web") {
      return;
   }

   const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
   if (!projectId) {
      return;
   }

   let permission = await Notifications.getPermissionsAsync();
   if (!permission.granted && permission.canAskAgain) {
      permission = await Notifications.requestPermissionsAsync();
   }
   if (!permission.granted) {
      return;
   }

   const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
   if (!token || token === (await AsyncStorage.getItem(PUSH_TOKEN_KEY))) {
      return;
   }

   if (await sendPushToken("POST", { token, platform: Platform.OS })) {
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
   }
}

export async function unregisterPushToken() {
   const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
   if (!token) {
      return;
   }

   try {
      await sendPushToken("DELETE", { token });
   } finally {
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
   }
}

export function usePushNotificationRegistration() {
   useEffect(() => {
      registerPushToken().catch(() => undefined);
   }, []);
}
