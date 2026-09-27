import {
   GoogleSignInError,
   exchangeGoogleIdToken,
   getGoogleClientConfiguration,
   googleSignInErrorMessage,
   storeDiscountMateSession,
} from "../googleAuth";

describe("Google authentication service", () => {
   test("selects the public client ID for each Expo platform", () => {
      const environment = {
         EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "web-client-id",
         EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: "ios-client-id",
         EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: "android-client-id",
      };

      expect(getGoogleClientConfiguration("web", environment)).toEqual({
         configured: true,
         clientId: "web-client-id",
      });
      expect(getGoogleClientConfiguration("ios", environment)).toEqual({
         configured: true,
         clientId: "ios-client-id",
      });
      expect(getGoogleClientConfiguration("android", environment)).toEqual({
         configured: true,
         clientId: "android-client-id",
      });
   });

   test("reports missing platform configuration without throwing", () => {
      expect(getGoogleClientConfiguration("web", {})).toEqual({
         configured: false,
         clientId: "",
      });
   });

   test("exchanges only the Google ID token for the DiscountMate session", async () => {
      const fetchImpl = jest.fn(async () => ({
         ok: true,
         status: 200,
         json: async () => ({
            message: "Signin successful",
            token: "discountmate-jwt",
            role: "user",
            admin: false,
         }),
      })) as unknown as typeof fetch;

      const session = await exchangeGoogleIdToken("signed-google-token", {
         apiUrl: "https://api.discountmate.app/api",
         fetchImpl,
      });

      expect(fetchImpl).toHaveBeenCalledWith(
         "https://api.discountmate.app/api/users/auth/google",
         expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken: "signed-google-token" }),
            signal: expect.any(AbortSignal),
         })
      );
      expect(session.token).toBe("discountmate-jwt");
   });

   test("rejects a successful backend response that does not contain a session token", async () => {
      const fetchImpl = jest.fn(async () => ({
         ok: true,
         status: 200,
         json: async () => ({ message: "Two-factor authentication required" }),
      })) as unknown as typeof fetch;

      await expect(exchangeGoogleIdToken("signed-google-token", {
         apiUrl: "https://api.discountmate.app/api",
         fetchImpl,
      })).rejects.toMatchObject({
         code: "invalid_session_response",
      });
   });

   test("preserves safe backend error codes for the interface", async () => {
      const fetchImpl = jest.fn(async () => ({
         ok: false,
         status: 409,
         json: async () => ({
            message: "This DiscountMate account is linked to another Google identity",
            code: "google_identity_conflict",
         }),
      })) as unknown as typeof fetch;

      await expect(exchangeGoogleIdToken("signed-google-token", {
         apiUrl: "https://api.discountmate.app/api",
         fetchImpl,
      })).rejects.toMatchObject({
         status: 409,
         code: "google_identity_conflict",
      });
   });

   test("turns a stalled DiscountMate exchange into controlled unavailability", async () => {
      const fetchImpl = jest.fn((_url: RequestInfo | URL, options?: RequestInit) => (
         new Promise<Response>((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
               reject(new Error("aborted"));
            });
         })
      )) as unknown as typeof fetch;

      await expect(exchangeGoogleIdToken("signed-google-token", {
         apiUrl: "https://api.discountmate.app/api",
         fetchImpl,
         timeoutMs: 5,
      })).rejects.toMatchObject({
         code: "authentication_unavailable",
         status: 503,
      });
   });

   test("stores only the DiscountMate token", async () => {
      const storage = { setItem: jest.fn(async () => undefined) };

      await storeDiscountMateSession({
         message: "Signin successful",
         token: "discountmate-jwt",
         role: "user",
         admin: false,
      }, storage);

      expect(storage.setItem).toHaveBeenCalledTimes(1);
      expect(storage.setItem).toHaveBeenCalledWith("authToken", "discountmate-jwt");
   });

   test("maps cancellation, popup, conflict, invalid, rate-limit, and unavailable failures", () => {
      expect(googleSignInErrorMessage(new GoogleSignInError("cancelled", 0, "cancelled")))
         .toBeNull();
      expect(googleSignInErrorMessage(new GoogleSignInError("popup_blocked", 0, "blocked")))
         .toContain("popup");
      expect(googleSignInErrorMessage(new GoogleSignInError("google_identity_conflict", 409, "conflict")))
         .toContain("already linked");
      expect(googleSignInErrorMessage(new GoogleSignInError("invalid_google_credential", 401, "invalid")))
         .toContain("could not be verified");
      expect(googleSignInErrorMessage(new GoogleSignInError("rate_limited", 429, "limited")))
         .toContain("Too many");
      expect(googleSignInErrorMessage(new GoogleSignInError("authentication_unavailable", 503, "offline")))
         .toContain("temporarily unavailable");
   });
});
