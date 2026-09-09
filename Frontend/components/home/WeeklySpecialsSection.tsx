import React, { useState, useEffect } from "react";   
import { View,Text,Pressable,ActivityIndicator,Image,} from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import AddButton from "../common/AddButton";
import { API_URL } from "@/constants/Api";
import { useCart } from "../../app/(tabs)/CartContext";
import { useShoppingLists } from "../../app/(tabs)/ShoppingListsContext";

interface WeeklySpecial {
   id: string | number;
   product_name: string;
   description: string;
   price: number;
   original_price: number;
   discount_percentage: number;
   savings: number;
   store: string;
   store_key: string;
   category: string;
   icon: string;
   image_url: string | null;
   product_id: string;
}

interface WeeklySpecialsResponse {
   success: boolean;
   data: WeeklySpecial[];
   count: number;
   week: string;
   error?: string;
}

export default function WeeklySpecialsSection() {
   const router = useRouter();
   const { addToCart } = useCart();
   const { getActiveList } = useShoppingLists();
   const [specials, setSpecials] = useState<WeeklySpecial[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      fetchWeeklySpecials();
   }, []);

   const fetchWeeklySpecials = async () => {
      try {
         setLoading(true);
         setError(null);

         const response = await fetch(`${API_URL}/products?limit=50`);

         if (!response.ok) {
            throw new Error(`Products request failed: ${response.status}`);
         }

         const result = await response.json();

         const liveSpecials: WeeklySpecial[] = (result.items || [])
            .filter((product: any) => {
               const currentPrice = Number(product.current_price) || 0;
               const bestPrice = Number(product.best_price) || 0;

               return (
                  product.is_on_special === true &&
                  currentPrice > 0 &&
                  bestPrice > 0 &&
                  bestPrice < currentPrice
               );
            })
            .filter(
               (product: any, index: number, array: any[]) =>
                  index ===
                  array.findIndex(
                     (p: any) => p.product_name === product.product_name
                  )
            )
            .slice(0, 4)
            .map((product: any) => {
               const originalPrice = Number(product.current_price);
               const specialPrice = Number(product.best_price);
               const savings = originalPrice - specialPrice;
               const discountPercentage =
                  originalPrice > 0
                     ? (savings / originalPrice) * 100
                     : 0;

               const storeKey = String(product.store_chain || "")
                  .replace("_generic", "")
                  .toLowerCase();

               const store =
                  storeKey === "coles"
                     ? "Coles"
                     : storeKey === "woolworths"
                       ? "Woolworths"
                       : storeKey === "iga"
                         ? "IGA"
                         : "Retailer";

               return {
                  id: product._id,
                  product_id: product._id,
                  product_name: product.product_name,
                  description: product.description || "",
                  price: specialPrice,
                  original_price: originalPrice,
                  discount_percentage: discountPercentage,
                  savings,
                  store,
                  store_key: storeKey,
                  category: product.category_name || "Other",
                  icon: "tag",
                  image_url: product.link_image || null,
               };
            });

         setSpecials(liveSpecials);
      } catch (err) {
         console.error("Error fetching weekly specials:", err);
         setError("Unable to load live weekly specials.");
      } finally {
         setLoading(false);
      }
   };

   const formatPrice = (price: number): string => {
      return `$${price.toFixed(2)}`;
   };

   const formatDiscount = (percentage: number): string => {
      return `${Math.round(percentage)}% OFF`;
   };

   const handleAddSpecial = async (item: WeeklySpecial) => {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
         router.push("/(auth)/login");
         return;
      }

      if (!getActiveList()) {
         router.push({
            pathname: "/(tabs)/my-lists",
            params: { create: "1" },
         });
         return;
      }

      const storeKey = item.store_key?.toLowerCase();
      addToCart({
         id: item.product_id || String(item.id),
         name: item.product_name,
         price: item.price,
         store: item.store,
         category: item.category,
         image: item.image_url ?? undefined,
         retailerPrices: {
            ...(storeKey === "coles" ? { coles: item.price } : {}),
            ...(storeKey === "woolworths" ? { woolworths: item.price } : {}),
            ...(storeKey === "iga" ? { iga: item.price } : {}),
         },
      });
   };

   return (
      <View className="bg-white border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-10">
               <View>
                  <Text className="text-3xl font-bold text-[#111827] mb-2">
                     This Week&apos;s Top Specials
                  </Text>
                  <Text className="text-gray-600">
                     Handpicked deals with the biggest savings
                  </Text>
               </View>

               <Pressable
                  className="px-8 py-4 rounded-xl bg-[#10B981]"
                  onPress={() => router.push("/(specials)/specials")}
               >
                  <Text className="text-white font-semibold">
                     View All Specials
                  </Text>
               </Pressable>
            </View>

            {/* Loading State */}
            {loading && (
               <View className="flex items-center justify-center py-20">
                  <ActivityIndicator size="large" color="#10B981" />
                  <Text className="mt-4 text-gray-600">
                     Loading this week&apos;s specials...
                  </Text>
               </View>
            )}

            {/* Error State */}
            {error && !loading && (
               <View className="flex items-center justify-center py-20">
                  <Text className="text-red-500 mb-4">{error}</Text>
                  <Pressable
                     onPress={fetchWeeklySpecials}
                     className="px-6 py-3 rounded-xl bg-[#10B981]"
                  >
                     <Text className="text-white font-semibold">Retry</Text>
                  </Pressable>
               </View>
            )}

            {/* Cards */}
            {!loading && !error && specials.length > 0 && (
               <View className="flex-row flex-wrap -mx-3">
                  {specials.map((item) => (
                     <Pressable
                        key={item.id}
                        onPress={() =>
                           router.push({
                              pathname: "/(product)/product/[id]",
                              params: {
                                 id: item.product_id || String(item.id),
                              },
                           })
                        }
                        className="w-full md:w-1/4 px-3 mb-6"
                     >
                        <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                           {/* Image / icon area + badge */}
                           <View className="relative">
                              <View className="w-full h-56 bg-gray-100 items-center justify-center">
                                 {item.image_url ? (
                                    <Image
                                       source={{ uri: item.image_url }}
                                       className="w-full h-56"
                                       resizeMode="contain"
                                    />
                                 ) : (
                                    <FontAwesome6
                                       name={item.icon || "circle-question"}
                                       size={32}
                                       color="#9CA3AF"
                                    />
                                 )}
                              </View>

                              <View className="absolute top-4 right-4">
                                 <View className="px-4 py-2 rounded-full bg-red-500">
                                    <Text className="text-white text-xs font-bold">
                                       {formatDiscount(item.discount_percentage)}
                                    </Text>
                                 </View>
                              </View>
                           </View>

                           {/* Content */}
                           <View className="p-5">
                              <Text className="text-base font-bold text-[#111827] mb-1">
                                 {item.product_name}
                              </Text>
                              <Text
                                 numberOfLines={3}
                                 className="text-xs text-gray-500 mb-4"
                              >
                                 {item.description?.replace(/<[^>]*>/g, "")}
                              </Text>

                              <View className="flex-row items-end justify-between mb-4">
                                 <View>
                                    <Text className="text-3xl font-bold text-[#111827]">
                                       {formatPrice(item.price)}
                                    </Text>
                                    <Text className="text-sm text-gray-400 line-through">
                                       {formatPrice(item.original_price)}
                                    </Text>
                                 </View>

                                 <View className="items-end">
                                    <Text className="text-xs text-gray-500 mb-1">
                                       at {item.store}
                                    </Text>
                                    <Text className="text-xs font-bold text-[#10B981]">
                                       Save {formatPrice(item.savings)}
                                    </Text>
                                 </View>
                              </View>

                              <View className="mt-2">
                                 <AddButton
                                    label="Add to List"
                                    onPress={(event) => {
                                       event.stopPropagation();
                                       void handleAddSpecial(item);
                                    }}
                                 />
                              </View>
                           </View>
                        </View>
                     </Pressable>
                  ))}
               </View>
            )}

            {/* Empty State */}
            {!loading && !error && specials.length === 0 && (
               <View className="flex items-center justify-center py-20">
                  <Text className="text-gray-500">
                     No specials available at this time.
                  </Text>
               </View>
            )}
         </View>
      </View>
   );
}