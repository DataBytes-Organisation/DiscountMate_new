import { expect, test } from "@playwright/test";

test("Google credential is exchanged for a persistent DiscountMate session", async ({
   page,
   context,
}) => {
   let exchangeBody: unknown;

   await context.route(
      "https://accounts.google.com/o/oauth2/v2/auth**",
      async (route) => {
         const authorizationUrl = new URL(route.request().url());
         const redirectUri = authorizationUrl.searchParams.get("redirect_uri");
         const state = authorizationUrl.searchParams.get("state");

         expect(authorizationUrl.searchParams.get("scope")?.split(" ")).toEqual(
            expect.arrayContaining(["openid", "email", "profile"])
         );
         expect(redirectUri).toBeTruthy();
         expect(state).toBeTruthy();

         const callback = `${redirectUri}#id_token=mock-google-id-token&state=${encodeURIComponent(state!)}`;
         await route.fulfill({
            contentType: "text/html",
            body: `<script>window.location.replace(${JSON.stringify(callback)});</script>`,
         });
      }
   );

   await page.route("**/api/users/auth/google", async (route) => {
      exchangeBody = route.request().postDataJSON();
      await route.fulfill({
         status: 200,
         json: {
            message: "Signin successful",
            token: "e2e-discountmate-jwt",
            role: "user",
            admin: false,
         },
      });
   });
   await page.route("**/api/users/profile", (route) => route.fulfill({
      status: 200,
      json: {
         user_fname: "Google",
         user_lname: "Tester",
         email: "google.tester@example.com",
         email_verified: true,
      },
   }));
   await page.route("**/api/notifications**", (route) => route.fulfill({
      json: { notifications: [] },
   }));

   await page.goto("/login");
   const googleButton = page.getByRole("button", { name: "Google", exact: true });
   await expect(googleButton).toBeEnabled();
   await googleButton.click();

   await expect.poll(() => exchangeBody).toEqual({
      idToken: "mock-google-id-token",
   });
   await expect.poll(() => page.evaluate(() => localStorage.getItem("authToken")))
      .toBe("e2e-discountmate-jwt");
   await expect(page).toHaveURL(/\/$/);

   await page.reload();
   await expect.poll(() => page.evaluate(() => localStorage.getItem("authToken")))
      .toBe("e2e-discountmate-jwt");
});
