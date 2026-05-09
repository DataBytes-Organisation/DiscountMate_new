import AsyncStorage from "@react-native-async-storage/async-storage";

export const SESSION_EXPIRED_MESSAGE = "Your session expired. Please log in again.";

export function isAuthErrorMessage(message?: string | null): boolean {
   return /jwt expired|invalid token|no token provided|unauthorized/i.test(
      String(message || "")
   );
}

export async function normalizeApiErrorMessage(
   message?: string | null,
   fallback = "Something went wrong."
): Promise<string> {
   if (isAuthErrorMessage(message)) {
      await AsyncStorage.removeItem("authToken");
      return SESSION_EXPIRED_MESSAGE;
   }

   const normalized = String(message || "").trim();
   return normalized || fallback;
}
