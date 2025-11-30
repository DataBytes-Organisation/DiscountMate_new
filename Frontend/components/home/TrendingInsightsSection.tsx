import React from "react";
import { View, Text, Pressable } from "react-native";

export default function TrendingInsightsSection() {
   return (
      <View className="bg-white border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
            <View className="mb-8">
               <Text className="text-3xl font-bold text-[#111827] mb-1">
                  Trending Insights
               </Text>
               <Text className="text-sm text-gray-600">
                  See what's moving in the market this week
               </Text>
            </View>

            <View className="flex-row flex-wrap -mx-3">
               {/* Dairy */}
               <View className="w-full md:w-1/3 px-3 mb-6">
                  <View className="rounded-2xl border border-[#10B98133] p-6 bg-[#ECFDF5]">
                     <View className="flex-row justify-between items-center mb-6">
                        <View className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#10B981] to-[#059669] items-center justify-center">
                           <Text className="text-xl text-white">📉</Text>
                        </View>
                        <Text className="text-sm font-bold text-[#10B981]">
                           23% price drop
                        </Text>
                     </View>
                     <Text className="text-xl font-bold text-[#111827] mb-2">
                        Dairy Products
                     </Text>
                     <Text className="text-sm text-gray-600 mb-4">
                        Average savings of $2.40 across milk, cheese, and yogurt
                     </Text>
                     <Pressable>
                        <Text className="text-sm font-semibold text-[#10B981]">
                           View all dairy deals →
                        </Text>
                     </Pressable>
                  </View>
               </View>

               {/* Household */}
               <View className="w-full md:w-1/3 px-3 mb-6">
                  <View className="rounded-2xl border border-[#FBBF244D] p-6 bg-[#FEF3C7]">
                     <View className="flex-row justify-between items-center mb-6">
                        <View className="w-14 h-14 rounded-xl bg-[#FBBF24] items-center justify-center">
                           <Text className="text-xl text-white">🔥</Text>
                        </View>
                        <Text className="text-sm font-bold text-[#F59E0B]">
                           Hot deals
                        </Text>
                     </View>
                     <Text className="text-xl font-bold text-[#111827] mb-2">
                        Household Essentials
                     </Text>
                     <Text className="text-sm text-gray-600 mb-4">
                        Bulk deals on cleaning supplies and paper products
                     </Text>
                     <Pressable>
                        <Text className="text-sm font-semibold text-[#F59E0B]">
                           Explore household →
                        </Text>
                     </Pressable>
                  </View>
               </View>

               {/* Fresh produce */}
               <View className="w-full md:w-1/3 px-3 mb-6">
                  <View className="rounded-2xl border border-blue-200 p-6 bg-[#DBEAFE]">
                     <View className="flex-row justify-between items-center mb-6">
                        <View className="w-14 h-14 rounded-xl bg-blue-500 items-center justify-center">
                           <Text className="text-xl text-white">📈</Text>
                        </View>
                        <Text className="text-sm font-bold text-blue-600">
                           Price watch
                        </Text>
                     </View>
                     <Text className="text-xl font-bold text-[#111827] mb-2">
                        Fresh Produce
                     </Text>
                     <Text className="text-sm text-gray-600 mb-4">
                        Seasonal fruits and vegetables at best prices
                     </Text>
                     <Pressable>
                        <Text className="text-sm font-semibold text-blue-600">
                           Check fresh produce →
                        </Text>
                     </Pressable>
                  </View>
               </View>
            </View>
         </View>
      </View>
   );
}
