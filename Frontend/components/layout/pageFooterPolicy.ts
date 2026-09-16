const LAYOUT_FOOTER_ROUTES = new Set([
   "profile",
   "notifications",
   "alert-segments",
   "subscription",
   "contact",
   "privacy-terms",
   "dashboard",
   "product-dashboard",
   "compare-powerbi",
   "basketsummary",
   "basketsummaryitem",
   "blog",
   "wishlist",
   "productpage",
   "login",
]);

const OWN_SCROLL_ROUTES = new Set(["compare", "my-lists", "shopping-session"]);

export function routeUsesLayoutFooter(segments: readonly string[]): boolean {
   return segments.some((segment) => LAYOUT_FOOTER_ROUTES.has(segment));
}

export function routeUsesOwnScroll(segments: readonly string[]): boolean {
   return segments.some((segment) => OWN_SCROLL_ROUTES.has(segment));
}

export function layoutContentPaddingBottom(segments: readonly string[]): number {
   return routeUsesLayoutFooter(segments) ? 0 : 24;
}
