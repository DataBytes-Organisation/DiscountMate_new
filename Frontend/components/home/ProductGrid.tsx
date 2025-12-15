// Frontend/components/product/ProductGrid.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import ProductCard, { Product } from "./ProductCard";
import ProductFilterSection from "../common/ProductFilterSection";
import { API_URL } from "@/constants/Api";

type ApiProduct = {
   _id: string;
   product_id?: string | number | null;
   product_name?: string | null;
   link_image?: string | null;
   current_price?: number | null;
   category?: string | null;
   best_price?: number | null;
   best_unit_price?: number | null;
   item_price?: number | null;
   unit_price?: number | null;
   link?: string | null;
};

// Fallback/sample products used when API data is unavailable.
const STATIC_PRODUCTS: Product[] = [
   {
      id: "static-milk-full-cream-2l",
      name: "Milk Full Cream 2L",
      subtitle: "Fresh dairy milk",
      icon: "wine-glass",
      badge: "Save $1.20",
      trendLabel: "Trending down",
      trendTone: "green",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$3.80",
            originalPrice: "$5.00",
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$4.20",
            originalPrice: "$5.00",
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$3.50",
            originalPrice: "$4.70",
            isCheapest: true,
         },
      ],
   },
   {
      id: "static-white-bread-700g",
      name: "White Bread 700g",
      subtitle: "Soft white sandwich bread",
      icon: "bread-slice",
      badge: "Save $0.85",
      trendLabel: "Price rising",
      trendTone: "red",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$2.50",
            originalPrice: "$3.35",
            isCheapest: true,
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$2.80",
            originalPrice: "$3.20",
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$2.90",
            originalPrice: "-",
         },
      ],
   },
   {
      id: "static-bananas-1kg",
      name: "Bananas 1kg",
      subtitle: "Fresh Australian bananas",
      icon: "apple-whole",
      badge: "Save $1.50",
      trendLabel: "Stable",
      trendTone: "neutral",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$3.20",
            originalPrice: "$4.00",
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$2.90",
            originalPrice: "$4.40",
            isCheapest: true,
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$3.10",
            originalPrice: "$3.90",
         },
      ],
   },
   {
      id: "static-pasta-penne-500g",
      name: "Pasta Penne 500g",
      subtitle: "Italian durum wheat pasta",
      icon: "wheat-awn",
      badge: "Save $0.50",
      trendLabel: "Trending down",
      trendTone: "green",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$2.00",
            originalPrice: "$2.50",
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$2.10",
            originalPrice: "$2.50",
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$1.79",
            originalPrice: "$2.29",
            isCheapest: true,
         },
      ],
   },
   {
      id: "static-cheddar-cheese-block-500g",
      name: "Cheddar Cheese Block 500g",
      subtitle: "Tasty mature cheddar",
      icon: "cheese",
      badge: "Save $2.30",
      trendLabel: "Hot deal",
      trendTone: "orange",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$7.50",
            originalPrice: "$9.00",
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$6.80",
            originalPrice: "$9.10",
            isCheapest: true,
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$7.20",
            originalPrice: "$8.50",
         },
      ],
   },
   {
      id: "static-orange-juice-2l",
      name: "Orange Juice 2L",
      subtitle: "100% pure squeezed orange juice",
      icon: "glass-water",
      badge: "Save $1.80",
      trendLabel: "Trending down",
      trendTone: "green",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$5.20",
            originalPrice: "$7.00",
            isCheapest: true,
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$5.50",
            originalPrice: "$6.80",
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$5.90",
            originalPrice: "$6.50",
         },
      ],
   },
   {
      id: "static-toilet-paper-24-pack",
      name: "Toilet Paper 24 Pack",
      subtitle: "Soft 3-ply quilted tissue",
      icon: "toilet-paper",
      badge: "Save $3.00",
      trendLabel: "Bulk deal",
      trendTone: "orange",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$16.00",
            originalPrice: "$19.00",
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$15.80",
            originalPrice: "$18.50",
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$14.99",
            originalPrice: "$17.99",
            isCheapest: true,
         },
      ],
   },
   {
      id: "static-coffee-beans-1kg",
      name: "Coffee Beans 1kg",
      subtitle: "Premium arabica coffee beans",
      icon: "mug-hot",
      badge: "Save $4.50",
      trendLabel: "Trending down",
      trendTone: "green",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$22.00",
            originalPrice: "$26.50",
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$21.50",
            originalPrice: "$26.00",
            isCheapest: true,
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$23.90",
            originalPrice: "$25.50",
         },
      ],
   },
   {
      id: "static-greek-yogurt-1kg",
      name: "Greek Yogurt 1kg",
      subtitle: "Natural full fat yogurt",
      icon: "bowl-food",
      badge: "Save $1.90",
      trendLabel: "Trending down",
      trendTone: "green",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$6.50",
            originalPrice: "$8.00",
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$6.80",
            originalPrice: "$8.20",
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$5.99",
            originalPrice: "$7.89",
            isCheapest: true,
         },
      ],
   },
];

// Simple deterministic pseudo-random generator based on a string seed.
function pseudoRandom(seed: string): number {
   let h = 0;
   for (let i = 0; i < seed.length; i++) {
      h = (h * 31 + seed.charCodeAt(i)) | 0;
   }
   // Convert to [0,1)
   return ((h >>> 0) % 10000) / 10000;
}

function pickFromArray<T>(arr: T[], seed: string): T {
   const index = Math.floor(pseudoRandom(seed) * arr.length);
   return arr[Math.max(0, Math.min(arr.length - 1, index))];
}

function mapApiProductToCard(product: ApiProduct): Product {
   const rawId = product.product_id ?? product._id;
   const id = String(rawId ?? "");

   const name =
      product.product_name?.trim() ||
      (typeof rawId === "string" && rawId.trim().length > 0
         ? `Product ${rawId}`
         : "Unnamed product");
   const category = product.category?.trim() || "";

   // Subtitle: use category if present, otherwise a randomized but stable tagline.
   const subtitle =
      category ||
      pickFromArray(
         [
            "Smart choice for everyday savings",
            "Popular pick this week",
            "Great value for families",
            "Customer favourite item",
         ],
         name + "-subtitle"
      );

   const numericPrice =
      typeof product.current_price === "number" && !isNaN(product.current_price)
         ? product.current_price
         : undefined;

   // Base price from data if available; otherwise synthesize a reasonable value.
   const basePrice = numericPrice ?? 5 + pseudoRandom(name + "-price") * 15; // $5–$20

   const baseOriginal =
      (typeof product.item_price === "number" && !isNaN(product.item_price)
         ? product.item_price
         : undefined) ??
      (typeof product.best_price === "number" && !isNaN(product.best_price)
         ? product.best_price
         : undefined) ??
      basePrice * (1.1 + pseudoRandom(name + "-original") * 0.3); // 10–40% higher

   const savings = Math.max(0, baseOriginal - basePrice);

   const badge =
      savings > 0
         ? `Save $${savings.toFixed(2)}`
         : pickFromArray(
            ["Hot deal", "Member offer", "Limited time", "Great value"],
            name + "-badge"
         );

   const icons: Product["icon"][] = [
      "wine-glass",
      "bread-slice",
      "apple-whole",
      "wheat-awn",
      "cheese",
      "glass-water",
      "toilet-paper",
      "mug-hot",
      "bowl-food",
      "tag",
   ];

   const icon = pickFromArray(icons, name + "-icon");

   const trendOptions: { label: string; tone: Product["trendTone"] }[] = [
      { label: "Trending down", tone: "green" },
      { label: "Stable", tone: "neutral" },
      { label: "Price rising", tone: "red" },
      { label: "Hot deal", tone: "orange" },
      { label: "Bulk deal", tone: "orange" },
   ];

   const trend = pickFromArray(trendOptions, name + "-trend");

   // Generate three retailers similar to the original layout, with Coles as
   // the primary data source and Woolworths/Aldi randomized around the same price.
   const woolworthsFactor = 0.95 + pseudoRandom(name + "-wool") * 0.15; // 0.95–1.10
   const aldiFactor = 0.9 + pseudoRandom(name + "-aldi") * 0.2; // 0.9–1.10

   const colesPrice = basePrice;
   const woolworthsPrice = basePrice * woolworthsFactor;
   const aldiPrice = basePrice * aldiFactor;

   const prices = [
      { storeKey: "coles" as const, name: "Coles", price: colesPrice },
      { storeKey: "woolworths" as const, name: "Woolworths", price: woolworthsPrice },
      { storeKey: "aldi" as const, name: "Aldi", price: aldiPrice },
   ];

   const cheapest = prices.reduce((min, p) =>
      p.price < min.price ? p : min
   );

   const originalForRetailer =
      baseOriginal > basePrice ? baseOriginal : basePrice * 1.15;

   const retailers = prices.map((p) => ({
      storeKey: p.storeKey,
      name: p.name,
      price: `$${p.price.toFixed(2)}`,
      originalPrice:
         originalForRetailer > p.price
            ? `$${originalForRetailer.toFixed(2)}`
            : undefined,
      isCheapest: p === cheapest,
   }));

   return {
      id: id || name,
      name,
      subtitle,
      icon,
      badge,
      trendLabel: trend.label,
      trendTone: trend.tone,
      retailers,
   };
}

const ProductGrid: React.FC = () => {
   const [apiProducts, setApiProducts] = useState<ApiProduct[]>([]);
   const [loading, setLoading] = useState<boolean>(true);
   const [error, setError] = useState<string | null>(null);
   const [currentPage, setCurrentPage] = useState<number>(1);

   const pageSize = 9; // cards per page

   useEffect(() => {
      const fetchProducts = async () => {
         try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${API_URL}/products`);
            const data = await response.json();

            if (!Array.isArray(data)) {
               throw new Error("Unexpected products response shape");
            }

            setApiProducts(data);
         } catch (err) {
            console.error("Error fetching products for home grid:", err);
            setError("Unable to load live products. Showing sample deals.");
         } finally {
            setLoading(false);
         }
      };

      fetchProducts();
   }, []);

   const sourceProducts: Product[] =
      apiProducts.length > 0
         ? apiProducts.map(mapApiProductToCard)
         : STATIC_PRODUCTS;

   const totalProducts = sourceProducts.length;
   const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
   const safePage = Math.min(Math.max(1, currentPage), totalPages);
   const startIndex = (safePage - 1) * pageSize;
   const pagedProducts = sourceProducts.slice(
      startIndex,
      startIndex + pageSize
   );

   const canGoPrev = safePage > 1;
   const canGoNext = safePage < totalPages;

   return (
      <ScrollView
         className="flex-1 px-4 md:px-8 pt-4 pb-10"
         contentContainerStyle={{ paddingBottom: 40 }}
      >
         {/* Product Filter Section */}
         <ProductFilterSection productCount={totalProducts} />

         {/* Loading state */}
         {loading && (
            <View className="py-10 items-center justify-center">
               <ActivityIndicator size="large" color="#0DAD79" />
               <Text className="mt-4 text-gray-600">
                  Loading products...
               </Text>
            </View>
         )}

         {/* Error message (we still show products, using fallback if needed) */}
         {error && !loading && (
            <View className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
               <Text className="text-sm text-red-700">{error}</Text>
            </View>
         )}

         {/* Product grid */}
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

         {/* Pagination */}
         {totalPages > 1 && (
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
      </ScrollView>
   );
};

export default ProductGrid;
