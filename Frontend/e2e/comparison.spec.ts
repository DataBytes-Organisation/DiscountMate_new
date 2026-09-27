import { expect, test, type Page } from "@playwright/test";

const productId = "11111111-1111-4111-8111-111111111111";
const aldiId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionId = "55555555-5555-4555-8555-555555555555";

test.beforeEach(async ({ page }) => {
   await page.route("**/api/notifications**", (route) => route.fulfill({ json: { notifications: [] } }));
   await page.route("**/api/users/profile**", (route) => route.fulfill({ status: 401, json: { message: "Anonymous" } }));
   await page.route("**/api/comparisons/events", (route) => route.fulfill({ status: 202, json: { data: { accepted: true } } }));
});

test("public single product comparison keeps history usable when forecast is partial", async ({ page }) => {
   const pageErrors: string[] = [];
   page.on("pageerror", (error) => pageErrors.push(error.message));
   await mockProductComparison(page);
   await page.goto("/compare");
   await page.getByRole("tab", { name: "Single Product" }).click();
   const searchInput = page.getByLabel("Search for a product to compare");
   await searchInput.fill("Devondale");
   const searchResults = page.getByLabel("Product search results");
   await expect(searchResults).toBeVisible();
   const inputBox = await searchInput.boundingBox();
   const resultsBox = await searchResults.boundingBox();
   expect(inputBox).not.toBeNull();
   expect(resultsBox).not.toBeNull();
   expect(resultsBox!.y).toBeGreaterThanOrEqual(inputBox!.y + inputBox!.height);
   await page.getByText("Devondale Full Cream Milk", { exact: true }).click();

   await expect(page.getByText("Cheapest at Aldi")).toBeVisible();
   await expect(page.getByText("$3.49", { exact: true }).first()).toBeVisible();
   await expect(page.getByText(/Forecast data is temporarily unavailable/)).toBeVisible();
   await expect(page.getByText("Price history and forecast")).toBeVisible();
   await expect(page.getByText("3M history", { exact: true })).toBeVisible();
   await expect(page.getByText("4W", { exact: true })).toHaveCount(0);
   await expect(page.getByText("6M", { exact: true })).toHaveCount(0);
   await expect(page.getByText("1Y", { exact: true })).toHaveCount(0);
   await expect(page.getByText("Regular price")).toHaveCount(0);
   await expect(page.getByText("comparison-v2.2", { exact: true })).toHaveCount(0);
   expect(pageErrors).toEqual([]);
});

test("authenticated grocery comparison exposes optimizer and partial coverage", async ({ page }) => {
   await mockGroceryComparison(page);

   await page.goto("/compare");
   await page.getByRole("tab", { name: /Grocery List/ }).click();
   await expect(page.getByText("Weekly groceries", { exact: true }).first()).toBeVisible();
   await expect(page.getByText("Lowest total cost")).toBeVisible();
   await expect(page.getByText("1 / 1")).toBeVisible();
   await expect(page.getByText("Include loyalty prices")).toBeVisible();
   await expect(page.getByText("Shortest travel")).toHaveCount(0);
   await expect(page.getByText("Preferred retailers")).toHaveCount(0);
});

test("start shopping preserves the comparison plan and exposes sequential retailer product links", async ({ page }) => {
   await mockGroceryComparison(page);
   const session = shoppingSession();
   await page.route("**/api/comparisons/runs/*/start-shopping", (route) => route.fulfill({ status: 201, json: { data: {
      runId: session.runId,
      planId: session.planId,
      sessionId: session.id,
      groups: session.groups,
      retailers: [{ retailerName: "Coles", urls: ["https://www.coles.com.au/product/1"] }],
   } } }));
   await page.route(`**/api/comparisons/shopping-sessions/${sessionId}`, (route) => route.fulfill({ json: { data: session } }));

   await page.goto("/compare");
   await page.getByRole("tab", { name: /Grocery List/ }).click();
   await page.getByText("Start shopping", { exact: true }).click();

   await expect(page.getByText("Your recommended basket is ready")).toBeVisible();
   await expect(page.getByText("Milk", { exact: true })).toBeVisible();
   await expect(page.getByText("Open next product", { exact: true })).toBeVisible();
   await expect(page.getByText(/Quantities are shown here for reference/)).toBeVisible();
   await expect(page.getByText("Preview automatic checkout", { exact: true })).toHaveCount(0);
   await expect(page.getByText("$3.49", { exact: true }).last()).toBeVisible();
});

test("customer-facing comparison routes render exactly one footer", async ({ page }) => {
   for (const route of ["/compare", "/compare-powerbi", "/profile"]) {
      await page.goto(route);
      await expect(page.getByText(`© ${new Date().getFullYear()} DiscountMate. All rights reserved.`)).toHaveCount(1);
   }
});

test("an unmapped grocery list shows an actionable empty state", async ({ page }) => {
   await page.addInitScript(() => localStorage.setItem("authToken", "e2e-token"));
   await page.route("**/api/shopping-lists", (route) => route.fulfill({ json: {
      lists: [{
         id: "696f64f96b7787e691e79020", name: "Unmapped list", description: "", accent: "emerald",
         createdLabel: "Today", updatedLabel: "Today", total: 2, savings: 0,
         items: [{ id: "legacy-custom", name: "Custom item", price: 2, quantity: 1 }],
      }],
      activeListId: "696f64f96b7787e691e79020",
   } }));
   await page.route("**/api/comparisons/lists/*/runs", (route) => route.fulfill({
      status: 422,
      json: { code: "no_mapped_items", message: "No saved-list products could be mapped." },
   }));

   await page.goto("/compare");
   await page.getByRole("tab", { name: /Grocery List/ }).click();
   await expect(page.getByText("No comparable products in this list yet")).toBeVisible();
   await expect(page.getByText("Comparison unavailable")).toHaveCount(0);
});

async function mockProductComparison(page: Page) {
   await page.route("**/api/comparisons/products?search=Devondale", (route) => route.fulfill({ json: { data: [{
      id: productId,
      name: "Devondale Full Cream Milk",
      brand: "Devondale",
      categoryName: "Dairy",
      packQuantity: "2",
      packUom: "L",
      imageUrl: null,
   }] } }));
   await page.route(`**/api/comparisons/products/${productId}**`, (route) => route.fulfill({ json: { data: {
      product: { id: productId, name: "Devondale Full Cream Milk", brand: "Devondale", categoryName: "Dairy", packQuantity: "2", packUom: "L", imageUrl: null },
      offers: [{ productId, retailerId: aldiId, retailerName: "Aldi", price: { amount: "3.49", currency: "AUD" }, difference: { amount: "0.00", currency: "AUD" }, unitPrice: "1.745", packQuantity: "2", packUom: "L", isOnSpecial: false, specialText: null, productUrl: "https://www.aldi.com.au/product/1", observedAt: new Date().toISOString(), availability: "in_stock", availabilitySource: "latest_price_inference", freshness: "latest" }],
      cheapest: { retailerId: aldiId, retailerName: "Aldi", price: { amount: "3.49", currency: "AUD" }, unitPrice: "1.745", observedAt: new Date().toISOString(), availability: "in_stock" },
      history: [
         { retailerId: aldiId, retailerName: "Aldi", price: { amount: "3.80", currency: "AUD" }, observedAt: "2026-07-01T00:00:00.000Z" },
         { retailerId: aldiId, retailerName: "Aldi", price: { amount: "3.70", currency: "AUD" }, observedAt: undefined },
      ],
      forecasts: [{
         retailerId: aldiId, retailerName: "Aldi", horizonDays: 14,
         predictedPrice: { amount: "3.49", currency: "AUD" }, predictedChangePercent: 0,
         forecastKind: "baseline", baselineReason: "insufficient_history", forecastAt: undefined, basedOnObservedAt: "2026-07-01T00:00:00.000Z",
         confidence: null, confidenceLabel: null, modelVersion: null,
      }],
      advice: { type: "compare_offers", title: "Compare current offers", reason: "No compatible current offers are available.", basis: "no_offer" },
      alternatives: { sameProductOtherSizes: [], similarProducts: [] },
      dataWatermark: new Date().toISOString(),
      calculationPolicyVersion: "comparison-v2.2",
      warnings: [{ section: "forecast", code: "forecast_partial", message: "Forecast data is temporarily unavailable for some retailers.", severity: "warning" }],
   } } }));
}

async function mockGroceryComparison(page: Page) {
   await page.addInitScript(() => localStorage.setItem("authToken", "e2e-token"));
   await page.route("**/api/shopping-lists", (route) => route.fulfill({ json: {
      lists: [{
         id: "696f64f96b7787e691e79020",
         name: "Weekly groceries",
         description: "",
         accent: "emerald",
         createdLabel: "Today",
         updatedLabel: "Today",
         total: 5,
         savings: 0,
         items: [{ id: productId, name: "Milk", price: 3.49, quantity: 1 }],
      }],
      activeListId: "696f64f96b7787e691e79020",
   } }));
   await page.route("**/api/comparisons/lists/*/runs", (route) => route.fulfill({ status: 201, json: { data: groceryRun() } }));
}

function groceryRun() {
   const plan = {
      id: "44444444-4444-4444-8444-444444444444",
      retailers: [{ retailerId: aldiId, retailerName: "Aldi" }],
      items: [{ productId, productName: "Milk", quantity: 1, retailerId: aldiId, retailerName: "Aldi", price: { amount: "3.49", currency: "AUD" }, productUrl: "https://www.aldi.com.au/product/1", observedAt: new Date().toISOString(), substitution: null }],
      total: { amount: "3.49", currency: "AUD" },
      savings: { amount: "0.41", currency: "AUD" },
      coverage: { found: 1, total: 1 },
      substitutions: 0,
   };
   return {
      id: "33333333-3333-4333-8333-333333333333",
      parentRunId: null,
      listId: "696f64f96b7787e691e79020",
      listName: "Weekly groceries",
      status: "completed",
      objective: "lowest_total",
      maxRetailers: 2,
      allowStoreBrandSubstitutions: true,
      calculationPolicyVersion: "comparison-v2.2",
      dataWatermark: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      items: [{ productId, name: "Milk", quantity: 1 }],
      retailerResults: [{ retailerId: aldiId, retailerName: "Aldi", total: plan.total, savings: plan.savings, coverage: plan.coverage, substitutions: 0, rankEligible: true, itemResults: plan.items }],
      plans: [plan],
      unavailableProductIds: [],
      warnings: [],
      suggestions: [],
   };
}

function shoppingSession() {
   return {
      id: sessionId,
      runId: "33333333-3333-4333-8333-333333333333",
      planId: "44444444-4444-4444-8444-444444444444",
      status: "active" as const,
      createdAt: "2026-08-22T00:00:00.000Z",
      groups: [{
         retailerName: "Coles",
         retailerCapability: "product_page" as const,
         linkStatus: "exact" as const,
         items: [{
            lineItemId: "milk-line",
            productId,
            productName: "Milk",
            imageUrl: null,
            quantity: 1,
            retailerId: aldiId,
            retailerName: "Coles",
            price: { amount: "3.49", currency: "AUD" as const },
            productUrl: "https://www.coles.com.au/product/1",
            retailerCapability: "product_page" as const,
            linkStatus: "exact" as const,
            observedAt: "2026-05-04T00:00:00.000Z",
            substitution: null,
            checked: false,
         }],
      }],
   };
}
