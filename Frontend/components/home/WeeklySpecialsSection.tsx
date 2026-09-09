import React, { useState, useEffect } from "react";
import {
   View,
   Text,
   Pressable,
   ActivityIndicator,
   Image,
} from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import AddButton from "../common/AddButton";
import { API_URL } from "@/constants/Api";
import { useCart } from "../../app/(tabs)/CartContext";
import { useShoppingLists } from "../../app/(tabs)/ShoppingListsContext";

interface WeeklySpecial {
   id?: number;
   product_name?: string | null;
   description?: string | null;
   price?: number | null;
   original_price?: number | null;
   discount_percentage?: number | null;
   savings?: number | null;
   store?: string | null;
   store_key?: string | null;
   category?: string | null;
   icon?: string | null;
   image_url?: string | null;
   product_id?: string | null;
}

interface WeeklySpecialsResponse {
   success: boolean;
   data: WeeklySpecial[];
   count: number;
   week: string;
   error?: string;
}
interface SpecialImageProps {
   imageUrl?: string | null;
   icon?: string | null;
   productName?: string | null;
}

function SpecialImage({
   imageUrl,
   icon,
   productName,
}: SpecialImageProps) {
   const [imageFailed, setImageFailed] = useState(false);
   const validImageUrl = imageUrl?.trim();

   useEffect(() => {
      setImageFailed(false);
   }, [validImageUrl]);

   if (validImageUrl && !imageFailed) {
      return (
         <Image
            source={{ uri: validImageUrl }}
            className="w-full h-56"
            resizeMode="cover"
            accessibilityLabel={
               productName?.trim() || "Weekly special product"
            }
            onError={() => setImageFailed(true)}
         />
      );
   }

   return (
      <View className="w-full h-56 bg-gray-100 items-center justify-center">
         <FontAwesome6
            name={icon || "image"}
            size={32}
            color="#9CA3AF"
         />
         <Text className="mt-3 text-sm text-gray-500">
            Image unavailable
         </Text>
      </View>
   );
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
      setSpecials([]);

      const response = await fetch(
         `${API_URL}/ml/weekly-specials?limit=4`
      );

      if (!response.ok) {
         throw new Error(
            `Weekly specials request failed with status ${response.status}`
         );
      }

      const data: WeeklySpecialsResponse = await response.json();

      if (!data.success) {
         throw new Error(
            data.error || "The weekly specials service returned an error."
         );
      }

      setSpecials(Array.isArray(data.data) ? data.data : []);
   } catch (err) {
      console.error("Error fetching weekly specials:", err);
      setSpecials([]);
      setError(
         "We couldn't load this week's specials. Please check your connection and try again."
      );
   } finally {
      setLoading(false);
   }
};

const formatPrice = (price?: number | null): string => {
   if (typeof price !== "number" || !Number.isFinite(price)) {
      return "Price unavailable";
   }

   return `$${price.toFixed(2)}`;
};

const formatDiscount = (
   percentage?: number | null
): string | null => {
   if (
      typeof percentage !== "number" ||
      !Number.isFinite(percentage)
   ) {
      return null;
   }

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

   const productId =
      item.product_id ||
      (item.id !== undefined ? String(item.id) : null);

   const productName = item.product_name?.trim();
   const productPrice = item.price;

   if (
      !productId ||
      !productName ||
      typeof productPrice !== "number" ||
      !Number.isFinite(productPrice)
   ) {
      console.warn(
         "Cannot add weekly special because required product data is missing.",
         item
      );
      return;
   }

   const storeName = item.store?.trim() || "Store unavailable";
   const categoryName =
      item.category?.trim() || "Uncategorised";
   const storeKey = item.store_key?.toLowerCase();

   addToCart({
      id: productId,
      name: productName,
      price: productPrice,
      store: storeName,
      category: categoryName,
      image: item.image_url || undefined,
      retailerPrices: {
         ...(storeKey === "coles"
            ? { coles: productPrice }
            : {}),
         ...(storeKey === "woolworths"
            ? { woolworths: productPrice }
            : {}),
         ...(storeKey === "iga"
            ? { iga: productPrice }
            : {}),
      },
   });
};

   return (
      <View className="bg-white border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
            {/* Header */}
            <View className="flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
               <View>
                  <Text className="text-3xl font-bold text-[#111827] mb-2">
                     This Week&apos;s Top Specials
                  </Text>
                  <Text className="text-gray-600">
                     Handpicked deals with the biggest savings
                  </Text>
               </View>

               <Pressable className="w-full md:w-auto px-8 py-4 rounded-xl bg-[#10B981] items-center">
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
                     <View
                           key={item.product_id || item.id}
                           className="w-full sm:w-1/2 lg:w-1/4 px-3 mb-6"
                        >
                        <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                           {/* Image / icon area + badge */}
                           <View className="relative">
                              <SpecialImage
                                 imageUrl={item.image_url}
                                 icon={item.icon}
                                 productName={item.product_name}
                              />

                              {formatDiscount(item.discount_percentage) && (
                              <View className="absolute top-4 right-4">
                                 <View className="px-4 py-2 rounded-full bg-red-500">
                                    <Text className="text-white text-xs font-bold">
                                       {formatDiscount(item.discount_percentage)}
                                    </Text>
                                 </View>
                              </View>
                           )}
                           </View>

                           {/* Content */}
                           <View className="p-5">
                              <Text className="text-base font-bold text-[#111827] mb-1">
                                 {item.product_name?.trim() || "Product name unavailable"}
                              </Text>
                              <Text className="text-xs text-gray-500 mb-4">
                                 {item.description?.trim() || "Description unavailable"}
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
                                       at {item.store?.trim() || "Store name unavailable"}
                                    </Text>
                                    <Text className="text-xs font-bold text-[#10B981]">
                                    {typeof item.savings === "number" &&
                                    Number.isFinite(item.savings)
                                       ? `Save ${formatPrice(item.savings)}`
                                       : "Savings unavailable"}
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
                     </View>
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
