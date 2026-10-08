import { layoutContentPaddingBottom, routeUsesLayoutFooter, routeUsesOwnScroll } from "../pageFooterPolicy";

test("Profile Hub and Power BI receive the shared layout footer", () => {
   for (const route of ["profile", "notifications", "alert-segments", "subscription", "contact", "privacy-terms", "dashboard", "compare-powerbi"]) {
      expect(routeUsesLayoutFooter(["(tabs)", route])).toBe(true);
   }
});

test("layout-owned footers remove the outer bottom gap", () => {
   expect(layoutContentPaddingBottom(["(tabs)", "profile"])).toBe(0);
   expect(layoutContentPaddingBottom(["(tabs)", "dashboard"])).toBe(0);
   expect(layoutContentPaddingBottom(["(tabs)", "unlisted-page"])).toBe(24);
});

test("Comparison, lists, and shopping sessions own their scroll and footer", () => {
   for (const route of ["compare", "my-lists", "shopping-session"]) {
      expect(routeUsesOwnScroll(["(tabs)", route])).toBe(true);
      expect(routeUsesLayoutFooter(["(tabs)", route])).toBe(false);
   }
});
