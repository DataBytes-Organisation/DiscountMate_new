import { API_URL } from "../constants/Api";

export type DiscountMateSession = {
   message: string;
   token: string;
   role: "user" | "admin";
   admin: boolean;
};

export type GoogleClientEnvironment = {
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string;
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?: string;
};

type TokenStorage = {
   setItem(key: string, value: string): Promise<unknown>;
};

type WebAuthStateStorage = {
   getItem(key: string): string | null;
   setItem(key: string, value: string): void;
   removeItem(key: string): void;
};

export const GOOGLE_WEB_AUTH_STATE_STORAGE_KEY =
   "discountmate.googleOAuthState";

export type GoogleWebAuthCallback =
   | { type: "success"; idToken: string }
   | { type: "cancel" };

export class GoogleSignInError extends Error {
   code: string;
   status: number;

   constructor(code: string, status: number, message: string) {
      super(message);
      this.name = "GoogleSignInError";
      this.code = code;
      this.status = status;
   }
}

export function getGoogleClientConfiguration(
   platform: string,
   environment: GoogleClientEnvironment = process.env as GoogleClientEnvironment
): { configured: boolean; clientId: string } {
   const selectedClientId =
      platform === "ios"
         ? environment.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
         : platform === "android"
            ? environment.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
            : environment.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
   const clientId = String(selectedClientId || "").trim();

   return { configured: Boolean(clientId), clientId };
}

export function rememberGoogleWebAuthState(
   state: string,
   storage: WebAuthStateStorage
): void {
   const normalizedState = state.trim();
   if (normalizedState) {
      storage.setItem(GOOGLE_WEB_AUTH_STATE_STORAGE_KEY, normalizedState);
   }
}

export function clearGoogleWebAuthState(storage: WebAuthStateStorage): void {
   storage.removeItem(GOOGLE_WEB_AUTH_STATE_STORAGE_KEY);
}

export function consumeGoogleWebAuthCallback(
   callbackUrl: string,
   storage: WebAuthStateStorage
): GoogleWebAuthCallback | null {
   const url = new URL(callbackUrl);
   const params = new URLSearchParams(url.hash.replace(/^#/, ""));
   const isGoogleCallback = params.has("id_token") || params.has("error");

   if (!isGoogleCallback) return null;

   const expectedState = storage.getItem(GOOGLE_WEB_AUTH_STATE_STORAGE_KEY);
   const returnedState = params.get("state");
   clearGoogleWebAuthState(storage);

   if (!expectedState || !returnedState || returnedState !== expectedState) {
      throw new GoogleSignInError(
         "invalid_google_credential",
         401,
         "Google authentication state did not match"
      );
   }

   if (params.get("error") === "access_denied") {
      return { type: "cancel" };
   }

   if (params.has("error")) {
      throw new GoogleSignInError(
         "provider_error",
         0,
         "Google did not complete sign-in"
      );
   }

   const idToken = String(params.get("id_token") || "").trim();
   if (!idToken) {
      throw new GoogleSignInError(
         "invalid_google_credential",
         401,
         "Google did not return a valid identity credential"
      );
   }

   return { type: "success", idToken };
}

export async function exchangeGoogleIdToken(
   idToken: string,
   {
      apiUrl = API_URL,
      fetchImpl = fetch,
      timeoutMs = 15_000,
   }: { apiUrl?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<DiscountMateSession> {
   if (!idToken.trim()) {
      throw new GoogleSignInError(
         "invalid_google_credential",
         401,
         "Google did not return a valid identity credential"
      );
   }

   const abortController = new AbortController();
   const timeout = setTimeout(() => abortController.abort(), timeoutMs);
   let response: Response;
   try {
      response = await fetchImpl(`${apiUrl}/users/auth/google`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ idToken }),
         signal: abortController.signal,
      });
   } catch {
      throw new GoogleSignInError(
         "authentication_unavailable",
         503,
         "Google sign-in is temporarily unavailable"
      );
   } finally {
      clearTimeout(timeout);
   }

   let body: Partial<DiscountMateSession> & { code?: string } = {};
   try {
      body = await response.json();
   } catch {
      body = {};
   }

   if (!response.ok) {
      throw new GoogleSignInError(
         String(body.code || "authentication_unavailable"),
         response.status,
         String(body.message || "Google sign-in failed")
      );
   }

   if (
      typeof body.token !== "string" ||
      !body.token ||
      (body.role !== "user" && body.role !== "admin") ||
      typeof body.admin !== "boolean"
   ) {
      throw new GoogleSignInError(
         "invalid_session_response",
         502,
         "DiscountMate did not return a valid session"
      );
   }

   return {
      message: String(body.message || "Signin successful"),
      token: body.token,
      role: body.role,
      admin: body.admin,
   };
}

export async function storeDiscountMateSession(
   session: DiscountMateSession,
   storage: TokenStorage
): Promise<void> {
   await storage.setItem("authToken", session.token);
}

export function googleSignInErrorMessage(error: unknown): string | null {
   if (!(error instanceof GoogleSignInError)) {
      return "Unable to complete Google sign-in. Please try again.";
   }

   switch (error.code) {
      case "cancelled":
         return null;
      case "popup_blocked":
         return "The Google sign-in popup was blocked. Allow popups and try again.";
      case "google_identity_conflict":
         return "This DiscountMate account is already linked to another Google identity.";
      case "invalid_google_credential":
         return "Your Google identity could not be verified. Please try signing in again.";
      case "rate_limited":
         return "Too many sign-in attempts. Please wait a few minutes and try again.";
      case "authentication_unavailable":
         return "Google sign-in is temporarily unavailable. Please try again later.";
      case "invalid_session_response":
         return "DiscountMate could not create your session. Please try again.";
      default:
         return error.message || "Unable to complete Google sign-in. Please try again.";
   }
}
