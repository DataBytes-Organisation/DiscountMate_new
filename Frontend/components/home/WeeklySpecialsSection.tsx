import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import AddButton from "../common/AddButton";
import { API_URL } from "@/constants/Api";

interface WeeklySpecial {
   id: number;
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

         const response = await fetch(`${API_URL}/ml/weekly-specials?limit=4`);
         const data: WeeklySpecialsResponse = await response.json();

         if (data.success && data.data) {
            setSpecials(data.data);
         } else {
            setError(data.error || "Failed to load weekly specials");
            // Fallback to empty array or show error message
            console.error("Error fetching weekly specials:", data.error);
         }
      } catch (err) {
         console.error("Error fetching weekly specials:", err);
         setError("Unable to connect to ML service. Please ensure the Python ML service is running.");
         // Keep empty array on error - component will show loading/error state
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

               <Pressable className="px-8 py-4 rounded-xl bg-[#10B981]">
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
                     <View key={item.id} className="w-full md:w-1/4 px-3 mb-6">
                        <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                           {/* Image / icon area + badge */}
                           <View className="relative">
                              <View className="w-full h-56 bg-gray-100 items-center justify-center">
                                 <FontAwesome6
                                    name={item.icon || "circle-question"}
                                    size={32}
                                    color="#9CA3AF"
                                 />
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
                              <Text className="text-xs text-gray-500 mb-4">
                                 {item.description}
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
                                 <AddButton label="Add to List" />
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
