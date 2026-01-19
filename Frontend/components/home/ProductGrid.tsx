// Frontend/components/product/ProductGrid.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import ProductCard, { Product } from "./ProductCard";
import ProductFilterSection from "../common/ProductFilterSection";
import { API_URL } from "@/constants/Api";

type ApiProduct = {
   _id: string;
   product_id?: string | number | null;
   product_name?: string | null;
   description?: string | null;
   link_image?: string | null;
   current_price?: number | null;
   category?: string | null;
   best_price?: number | null;
   best_unit_price?: number | null;
   item_price?: number | null;
   unit_price?: number | null;
   link?: string | null;
};

function mapApiProductToCard(product: ApiProduct): Product {
   // Always use _id for consistency in URLs since it's guaranteed to exist for all MongoDB documents
   // The backend's getProduct endpoint can handle both _id (MongoDB ObjectId) and product_code
   const rawId = product._id ?? product.product_id;
   const id = String(rawId ?? "");

   const name =
      product.product_name?.trim() ||
      (typeof rawId === "string" && rawId.trim().length > 0
         ? `Product ${rawId}`
         : "Unnamed product");
   const category = product.category?.trim() || "";

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

   console.log(subtitle);

   // Use price from API, default to 0 if not available
   const basePrice =
      typeof product.current_price === "number" && !isNaN(product.current_price)
         ? product.current_price
         : 0;

   const baseOriginal =
      (typeof product.item_price === "number" && !isNaN(product.item_price)
         ? product.item_price
         : undefined) ??
      (typeof product.best_price === "number" && !isNaN(product.best_price)
         ? product.best_price
         : undefined) ??
      basePrice;

   const savings = Math.max(0, baseOriginal - basePrice);

   // Use unit price (or best_unit_price) for Coles unit price display
   const unitPriceValue =
      typeof product.unit_price === "number" && !isNaN(product.unit_price)
         ? product.unit_price
         : typeof product.best_unit_price === "number" && !isNaN(product.best_unit_price)
            ? product.best_unit_price
            : null;

   const colesUnitPriceLabel =
      unitPriceValue != null ? `$${unitPriceValue.toFixed(2)} / unit` : undefined;

   const badge = savings > 0 ? `Save $${savings.toFixed(2)}` : "Great value";

   // Use default icon
   const icon: Product["icon"] = "tag";

   // Use default trend
   const trend = { label: "Stable", tone: "neutral" as Product["trendTone"] };

   // Only Coles has pricing data; other retailers set to 0 for now
   const colesPrice = basePrice;
   const woolworthsPrice = 0;
   const aldiPrice = 0;

   const prices = [
      { storeKey: "coles" as const, name: "Coles", price: colesPrice },
      { storeKey: "woolworths" as const, name: "Woolworths", price: woolworthsPrice },
      { storeKey: "aldi" as const, name: "Aldi", price: aldiPrice },
   ];

   // Coles is always the cheapest (and only one with pricing)
   const cheapest = prices.find(p => p.storeKey === "coles") || prices[0];

   const originalForRetailer =
      baseOriginal > basePrice ? baseOriginal : basePrice * 1.15;

   const retailers = prices.map((p) => ({
      storeKey: p.storeKey,
      name: p.name,
      price: p.price > 0 ? `$${p.price.toFixed(2)}` : "$0.00",
      originalPrice:
         p.storeKey === "coles" && originalForRetailer > p.price
            ? `$${originalForRetailer.toFixed(2)}`
            : undefined,
      isCheapest: p === cheapest,
      // Since all products are currently from Coles, surface the unit price specifically on the Coles retailer card.
      unitPriceLabel: p.storeKey === "coles" ? colesUnitPriceLabel : undefined,
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
};

const ProductGrid: React.FC<ProductGridProps> = ({
   activeCategory,
   searchQuery,
   priceRangeFilter,
}) => {
   const [apiProducts, setApiProducts] = useState<ApiProduct[]>([]);
   const [loading, setLoading] = useState<boolean>(true);
   const [error, setError] = useState<string | null>(null);
   const [currentPage, setCurrentPage] = useState<number>(1);
   const [totalProducts, setTotalProducts] = useState<number>(0);
   const [totalPagesFromApi, setTotalPagesFromApi] = useState<number | null>(null);

   const pageSize = 9; // cards per page

   useEffect(() => {
      const fetchProducts = async (page: number, category?: string, search?: string) => {
         try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("limit", String(pageSize));

            if (category && category !== "All") {
               params.set("category", category);
            }

            if (search && search.trim().length > 0) {
               params.set("search", search.trim());
            }

            const response = await fetch(
               `${API_URL}/products?${params.toString()}`
            );
            const data = await response.json();

            // Support both the new paginated shape and the legacy
            // "array of products" shape so other callers that rely on products still work while the backend is evolving.
            let items: ApiProduct[] = [];
            let total = 0;
            let totalPages = 1;

            if (Array.isArray(data)) {
               items = data;
               total = data.length;
               totalPages = Math.max(1, Math.ceil(total / pageSize));
            } else if (data && Array.isArray(data.items)) {
               items = data.items;
               total =
                  typeof data.total === "number" ? data.total : data.items.length;
               totalPages =
                  typeof data.totalPages === "number"
                     ? data.totalPages
                     : Math.max(1, Math.ceil(total / pageSize));
            } else {
               throw new Error("Unexpected products response shape");
            }

            setApiProducts(items);
            setTotalProducts(total);
            setTotalPagesFromApi(totalPages);
         } catch (err) {
            console.error("Error fetching products for home grid:", err);
            setError(
               "We couldn't load products just now. Please refresh the page to try again."
            );
         } finally {
            setLoading(false);
         }
      };

      fetchProducts(currentPage, activeCategory, searchQuery);
   }, [currentPage, activeCategory, searchQuery]);

   useEffect(() => {
      // Reset to first page when the category or search query changes
      setCurrentPage(1);
   }, [activeCategory, searchQuery]);

   // Apply price range filter on unit price (or best_unit_price as fallback)
   const hasPriceRangeFilter =
      !!priceRangeFilter &&
      (priceRangeFilter.min != null || priceRangeFilter.max != null);

   const filteredApiProducts: ApiProduct[] = apiProducts.filter((product) => {
      if (!hasPriceRangeFilter) {
         return true;
      }

      const unit =
         typeof product.unit_price === "number" && !isNaN(product.unit_price)
            ? product.unit_price
            : typeof product.best_unit_price === "number" && !isNaN(product.best_unit_price)
               ? product.best_unit_price
               : null;

      if (unit == null) {
         // If we have no unit price information, keep the product
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

   const totalPages =
      totalPagesFromApi && totalPagesFromApi > 0
         ? totalPagesFromApi
         : Math.max(1, Math.ceil((totalProducts || productsToShow.length) / pageSize));
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
               {overallProductCount === 0 && !error ? (
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
