// Frontend/components/product/ProductGrid.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import ProductCard, { Product } from "./ProductCard";
import ProductFilterSection from "../common/ProductFilterSection";
import { API_URL } from "@/constants/Api";

type ApiProduct = {
   _id: string;
   product_name?: string | null;
   product_code?: string | null;
   description?: string | null;
   link_image?: string | null;
   current_price?: number | null;
   unit_price?: string | null;
   store_chain?: string | null;
   /** Latest Coles shelf price from product_pricings (coles_generic) */
   coles_price?: number | null;
   coles_unit_price?: string | null;
   /** Latest Woolworths shelf price from product_pricings (woolworths_generic) */
   woolworths_price?: number | null;
   woolworths_unit_price?: string | null;
};

function pickPositivePrice(value: unknown): number | null {
   if (typeof value !== "number" || isNaN(value) || value <= 0) return null;
   return value;
}

function formatShelfPrice(value: number | null): string {
   if (value == null) return "-";
   return `$${value.toFixed(2)}`;
}

function sanitizeUnitLabel(raw: string | null | undefined): string | undefined {
   if (raw == null || !String(raw).trim()) return undefined;
   const s = String(raw).trim();
   if (/nan/i.test(s)) return undefined;
   return s;
}

/** First numeric value in a unit_price string (e.g. "0.008 per g") for range filters only. */
function parseUnitNumericFromProduct(product: ApiProduct): number | null {
   const candidates = [
      product.unit_price,
      product.coles_unit_price,
      product.woolworths_unit_price,
   ];
   for (const c of candidates) {
      if (c == null || !String(c).trim()) continue;
      const m = String(c).match(/[\d]+(?:\.[\d]+)?/);
      if (m) {
         const n = parseFloat(m[0]);
         if (!isNaN(n)) return n;
      }
   }
   return null;
}

/** Resolves Coles / Woolworths shelf prices (incl. legacy single-store current_price). Aldi has no API price here. */
function resolveColesWoolworthsPrices(product: ApiProduct): {
   colesPriceNum: number | null;
   woolworthsPriceNum: number | null;
} {
   let colesPriceNum = pickPositivePrice(product.coles_price);
   let woolworthsPriceNum = pickPositivePrice(product.woolworths_price);

   if (colesPriceNum == null && woolworthsPriceNum == null) {
      const legacy = pickPositivePrice(product.current_price);
      if (legacy != null) {
         if (product.store_chain === "woolworths_generic") {
            woolworthsPriceNum = legacy;
         } else {
            colesPriceNum = legacy;
         }
      }
   }

   return { colesPriceNum, woolworthsPriceNum };
}

function apiProductHasShelfPrice(product: ApiProduct): boolean {
   const { colesPriceNum, woolworthsPriceNum } = resolveColesWoolworthsPrices(product);
   return colesPriceNum != null || woolworthsPriceNum != null;
}

function parseProductsPayload(
   data: unknown,
   limitForFallback: number
): {
   items: ApiProduct[];
   total: number;
   totalPages: number;
} {
   if (Array.isArray(data)) {
      const items = data as ApiProduct[];
      return {
         items,
         total: items.length,
         totalPages: Math.max(1, Math.ceil(items.length / Math.max(1, limitForFallback))),
      };
   }
   const d = data as { items?: ApiProduct[]; total?: number; totalPages?: number };
   if (d && Array.isArray(d.items)) {
      const total = typeof d.total === "number" ? d.total : d.items.length;
      return {
         items: d.items,
         total,
         totalPages:
            typeof d.totalPages === "number"
               ? d.totalPages
               : Math.max(1, Math.ceil(total / Math.max(1, limitForFallback))),
      };
   }
   throw new Error("Unexpected products response shape");
}

/** One API page per UI page: `GET /products?page=&limit=` (matches backend pagination). */
async function fetchProductsPage(
   page: number,
   limit: number,
   category: string | undefined,
   search: string | undefined,
   signal?: AbortSignal
): Promise<{ items: ApiProduct[]; total: number; totalPages: number }> {
   const params = new URLSearchParams();
   params.set("page", String(page));
   params.set("limit", String(limit));

   if (category && category !== "All") {
      params.set("category", category);
   }
   if (search && search.trim().length > 0) {
      params.set("search", search.trim());
   }

   const response = await fetch(`${API_URL}/products?${params.toString()}`, {
      signal,
   });
   if (!response.ok) {
      throw new Error(`Products request failed: ${response.status}`);
   }
   const data = await response.json();
   return parseProductsPayload(data, limit);
}

function mapApiProductToCard(product: ApiProduct): Product {
   // Always use _id for consistency in URLs since it's guaranteed to exist for all MongoDB documents
   // The backend's getProduct endpoint can handle both _id (MongoDB ObjectId) and product_code
   const rawId = product._id;
   const id = String(rawId ?? "");

   const name =
      product.product_name?.trim() ||
      (typeof rawId === "string" && rawId.trim().length > 0
         ? `Product ${rawId}`
         : "Unnamed product");
   const category = "";

   // Truncate description for grid display
   const truncateDescription = (text: string | null | undefined, maxWords: number = 20): string => {
      if (!text) return "no description";

      // Strip HTML tags
      const stripped = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

      if (!stripped) return "no description";

      // Split into words and truncate
      const words = stripped.split(/\s+/);
      if (words.length <= maxWords) {
         return stripped;
      }

      return words.slice(0, maxWords).join(" ") + "...";
   };

   // Use description from API, truncated for grid display
   const subtitle = truncateDescription(product.description);

   const { colesPriceNum, woolworthsPriceNum } = resolveColesWoolworthsPrices(product);

   const colesUnitPriceLabel = sanitizeUnitLabel(product.coles_unit_price);
   const woolworthsUnitPriceLabel = sanitizeUnitLabel(product.woolworths_unit_price);

   const badge = "Great value";

   // Use default icon
   const icon: Product["icon"] = "tag";

   // Use default trend
   const trend = { label: "Stable", tone: "neutral" as Product["trendTone"] };

   const prices: Array<{
      storeKey: "coles" | "woolworths" | "aldi";
      name: string;
      price: number | null;
   }> = [
         { storeKey: "coles", name: "Coles", price: colesPriceNum },
         { storeKey: "woolworths", name: "Woolworths", price: woolworthsPriceNum },
         { storeKey: "aldi", name: "Aldi", price: null },
      ];

   const pricedEntries = prices.filter(
      (p): p is typeof p & { price: number } => p.price != null && p.price > 0
   );
   const cheapestEntry =
      pricedEntries.length > 0
         ? pricedEntries.reduce((a, b) => (a.price <= b.price ? a : b))
         : null;

   const retailers = prices.map((p) => ({
      storeKey: p.storeKey,
      name: p.name,
      price: formatShelfPrice(p.price),
      isCheapest: cheapestEntry != null && cheapestEntry.storeKey === p.storeKey,
      unitPriceLabel:
         p.storeKey === "coles"
            ? colesUnitPriceLabel
            : p.storeKey === "woolworths"
               ? woolworthsUnitPriceLabel
               : undefined,
   }));

   return {
      id: id || name,
      name,
      subtitle,
      category,
      icon,
      link_image: product.link_image || null,
      badge,
      trendLabel: trend.label,
      trendTone: trend.tone,
      retailers,
   };
}

type ProductGridProps = {
   activeCategory?: string;
   searchQuery?: string;
   priceRangeFilter?: { min: number | null; max: number | null };
   requireSearch?: boolean;
};

const ProductGrid: React.FC<ProductGridProps> = ({
   activeCategory,
   searchQuery,
   priceRangeFilter,
   requireSearch = false,
}) => {
   const [apiProducts, setApiProducts] = useState<ApiProduct[]>([]);
   const [loading, setLoading] = useState<boolean>(true);
   const [error, setError] = useState<string | null>(null);
   const [currentPage, setCurrentPage] = useState<number>(1);
   const [totalProducts, setTotalProducts] = useState<number>(0);
   const [totalPagesFromApi, setTotalPagesFromApi] = useState<number | null>(null);

   const pageSize = 9; // cards per page

   useEffect(() => {
      const hasSearch = typeof searchQuery === "string" && searchQuery.trim().length > 0;
      if (requireSearch && !hasSearch) {
         setApiProducts([]);
         setTotalProducts(0);
         setTotalPagesFromApi(0);
         setError(null);
         setLoading(false);
         return;
      }

      const ac = new AbortController();

      const run = async () => {
         try {
            setLoading(true);
            setError(null);

            const { items, total, totalPages } = await fetchProductsPage(
               currentPage,
               pageSize,
               activeCategory,
               searchQuery,
               ac.signal
            );

            setApiProducts(items);
            setTotalProducts(total);
            setTotalPagesFromApi(totalPages);
         } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") {
               return;
            }
            console.error("Error fetching products for home grid:", err);
            setError(
               "We couldn't load products just now. Please refresh the page to try again."
            );
         } finally {
            if (!ac.signal.aborted) {
               setLoading(false);
            }
         }
      };

      run();
      return () => ac.abort();
   }, [currentPage, activeCategory, searchQuery, requireSearch]);

   useEffect(() => {
      // Reset to first page when the category or search query changes
      setCurrentPage(1);
   }, [activeCategory, searchQuery]);

   useEffect(() => {
      if (totalPagesFromApi == null || totalPagesFromApi < 1) return;
      setCurrentPage((p) => (p > totalPagesFromApi ? totalPagesFromApi : p));
   }, [totalPagesFromApi]);

   // Apply price range filter on parsed unit_price / coles_unit_price / woolworths_unit_price
   const hasPriceRangeFilter =
      !!priceRangeFilter &&
      (priceRangeFilter.min != null || priceRangeFilter.max != null);

   const filteredApiProducts: ApiProduct[] = apiProducts.filter((product) => {
      if (!apiProductHasShelfPrice(product)) {
         return false;
      }

      if (!hasPriceRangeFilter) {
         return true;
      }

      const unit = parseUnitNumericFromProduct(product);

      if (unit == null) {
         return true;
      }

      if (priceRangeFilter?.min != null && unit < priceRangeFilter.min) {
         return false;
      }

      if (priceRangeFilter?.max != null && unit > priceRangeFilter.max) {
         return false;
      }

      return true;
   });

   const apiMappedProducts: Product[] = filteredApiProducts.map(mapApiProductToCard);

   // When backend provides pagination totals, rely on those; otherwise fall back to the current payload length.
   const productsToShow = apiMappedProducts;

   // For the "Showing X products" label, prefer the total count returned  by the backend so it reflects all matching products, not just the current page. When a client-side price range filter is active we can only count the products we've actually filtered on the current page, so fall back to that in that case.
   const overallProductCount = hasPriceRangeFilter
      ? productsToShow.length
      : (totalProducts || productsToShow.length);

   const totalPages = Math.max(
      1,
      totalPagesFromApi != null && totalPagesFromApi > 0
         ? totalPagesFromApi
         : Math.max(1, Math.ceil((totalProducts || 0) / pageSize))
   );

   const safePage = Math.min(Math.max(1, currentPage), totalPages);
   const pagedProducts = productsToShow;

   const canGoPrev = safePage > 1;
   const canGoNext = safePage < totalPages;

   return (
      <ScrollView
         className="flex-1 px-4 md:px-8 pt-4 pb-10"
         contentContainerStyle={{ paddingBottom: 40 }}
      >
         {/* Product Filter Section */}
         <ProductFilterSection productCount={loading ? 0 : overallProductCount} />

         {/* Error message */}
         {error && !loading && (
            <View className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
               <Text className="text-sm text-red-700">{error}</Text>
            </View>
         )}

         {/* Loading state - Skeleton loaders */}
         {loading ? (
            <View className="flex-row flex-wrap -mx-2">
               {Array.from({ length: pageSize }).map((_, index) => (
                  <View
                     key={`skeleton-${index}`}
                     className="w-full md:w-1/2 lg:w-1/3 px-2 mb-6"
                  >
                     <ProductCardSkeleton />
                  </View>
               ))}
            </View>
         ) : (
            <>
               {/* Empty state when there are no products to show (e.g. category has none or filters exclude all) */}
               {!error && productsToShow.length === 0 ? (
                  <View className="border border-dashed border-gray-200 rounded-2xl p-8 items-center justify-center bg-white">
                     <Text className="text-base font-semibold text-gray-700 mb-1">
                        There are currently no products to show.
                     </Text>
                     <Text className="text-sm text-gray-500">
                        Try choosing another category or check back again soon.
                     </Text>
                  </View>
               ) : (
                  <View className="flex-row flex-wrap -mx-2">
                     {pagedProducts.map((product) => (
                        <View
                           key={product.id}
                           className="w-full md:w-1/2 lg:w-1/3 px-2 mb-6"
                        >
                           <ProductCard product={product} />
                        </View>
                     ))}
                  </View>
               )}

               {/* Pagination - only show when there are products to display */}
               {productsToShow.length > 0 && totalPages > 1 && (
                  <View className="mt-8 flex-row items-center justify-center space-x-2">
                     {/* First page */}
                     <Pressable
                        className={`px-3 py-2 rounded-xl border-2 ${safePage > 1
                           ? "border-gray-200"
                           : "border-gray-100 bg-gray-50"
                           }`}
                        disabled={safePage === 1}
                        onPress={() => setCurrentPage(1)}
                     >
                        <Text
                           className={`text-sm ${safePage > 1 ? "text-emerald-500" : "text-gray-300"
                              }`}
                        >
                           {"≪"}
                        </Text>
                     </Pressable>

                     {/* Previous */}
                     <Pressable
                        className={`px-3 py-2 rounded-xl border-2 ${canGoPrev
                           ? "border-gray-200"
                           : "border-gray-100 bg-gray-50"
                           }`}
                        disabled={!canGoPrev}
                        onPress={() =>
                           setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                     >
                        <Text
                           className={`text-sm ${canGoPrev ? "text-emerald-500" : "text-gray-300"
                              }`}
                        >
                           {"<"}
                        </Text>
                     </Pressable>

                     {/* Numbered pages (max 5, current centered when possible) */}
                     {(() => {
                        const maxVisible = 5;
                        let start = Math.max(1, safePage - 2);
                        let end = Math.min(totalPages, safePage + 2);

                        if (end - start + 1 < maxVisible) {
                           if (start === 1) {
                              end = Math.min(totalPages, start + maxVisible - 1);
                           } else if (end === totalPages) {
                              start = Math.max(1, end - maxVisible + 1);
                           }
                        }

                        const pages: number[] = [];
                        for (let p = start; p <= end; p++) {
                           pages.push(p);
                        }

                        return pages.map((page) => {
                           const isActive = page === safePage;
                           return (
                              <Pressable
                                 key={page}
                                 onPress={() => setCurrentPage(page)}
                                 className={
                                    isActive
                                       ? "px-4 py-2 rounded-xl bg-emerald-500"
                                       : "px-4 py-2 rounded-xl border-2 border-gray-200 bg-white"
                                 }
                              >
                                 <Text
                                    className={
                                       isActive
                                          ? "text-sm font-semibold text-white"
                                          : "text-sm font-semibold text-emerald-500"
                                    }
                                 >
                                    {page}
                                 </Text>
                              </Pressable>
                           );
                        });
                     })()}

                     {/* Next */}
                     <Pressable
                        className={`px-3 py-2 rounded-xl border-2 ${canGoNext
                           ? "border-gray-200"
                           : "border-gray-100 bg-gray-50"
                           }`}
                        disabled={!canGoNext}
                        onPress={() =>
                           setCurrentPage((prev) =>
                              Math.min(totalPages, prev + 1)
                           )
                        }
                     >
                        <Text
                           className={`text-sm ${canGoNext ? "text-emerald-500" : "text-gray-300"
                              }`}
                        >
                           {">"}
                        </Text>
                     </Pressable>

                     {/* Last page */}
                     <Pressable
                        className={`px-3 py-2 rounded-xl border-2 ${safePage < totalPages
                           ? "border-gray-200"
                           : "border-gray-100 bg-gray-50"
                           }`}
                        disabled={safePage === totalPages}
                        onPress={() => setCurrentPage(totalPages)}
                     >
                        <Text
                           className={`text-sm ${safePage < totalPages ? "text-emerald-500" : "text-gray-300"
                              }`}
                        >
                           {"≫"}
                        </Text>
                     </Pressable>
                  </View>
               )}
            </>
         )}
      </ScrollView>
   );
};

// Skeleton loader component matching ProductCard layout
const ProductCardSkeleton: React.FC = () => {
   return (
      <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
         <View className="p-5">
            {/* Top: icon + title + badges */}
            <View className="flex-row items-start gap-4 mb-4">
               <View className="w-24 h-24 rounded-xl bg-gray-200 flex-shrink-0" />
               <View className="flex-1 min-w-0">
                  <View className="h-5 bg-gray-200 rounded mb-2" style={{ width: "80%" } as any} />
                  <View className="h-3 bg-gray-100 rounded mb-3" style={{ width: "60%" } as any} />
                  <View className="flex-row flex-wrap items-center gap-2">
                     <View className="h-5 bg-gray-200 rounded-full" style={{ width: 70 } as any} />
                     <View className="h-5 bg-gray-100 rounded" style={{ width: 90 } as any} />
                  </View>
               </View>
            </View>

            {/* Retailer grid */}
            <View className="border-t border-gray-100 pt-4 mb-4">
               <View className="flex-row justify-between gap-3">
                  {[1, 2, 3].map((i) => (
                     <View key={i} className="flex-1 p-2 rounded-lg bg-gray-50 items-center">
                        <View className="h-3 bg-gray-200 rounded mb-2" style={{ width: "60%" } as any} />
                        <View className="h-4 bg-gray-300 rounded mb-1" style={{ width: "50%" } as any} />
                        <View className="h-2 bg-gray-100 rounded" style={{ width: "40%" } as any} />
                     </View>
                  ))}
               </View>
            </View>

            {/* Actions row */}
            <View className="flex-row items-center gap-2">
               <View className="flex-1 h-10 bg-gray-200 rounded-xl" />
               <View className="w-10 h-10 bg-gray-200 rounded-xl" />
               <View className="w-10 h-10 bg-gray-200 rounded-xl" />
            </View>
         </View>
      </View>
   );
};

export default ProductGrid;
