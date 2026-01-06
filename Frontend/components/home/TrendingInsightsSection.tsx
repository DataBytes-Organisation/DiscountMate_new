import React from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export default function TrendingInsightsSection() {
   return (
      <View className="bg-white border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
            {/* Header */}
            <View className="mb-10">
               <Text className="text-3xl font-bold text-[#111827] mb-2">
                  Trending Insights
               </Text>
               <Text className="text-gray-600">
                  See what's moving in the market this week
               </Text>
            </View>

            {/* Cards */}
            <View className="flex flex-col md:flex-row gap-6">
               {/* Dairy Products */}
               <Pressable className="flex-1">
                  <View className="bg-gradient-to-br from-primary_green/5 to-secondary_green/5 border border-primary_green/20 rounded-2xl p-8 hover:shadow-lg transition-all">
                     <View className="flex-row items-center justify-between mb-6">
                        <View className="w-14 h-14 bg-gradient-to-br from-primary_green to-secondary_green rounded-xl flex items-center justify-center shadow-md">
                           <FontAwesome6
                              name="arrow-trend-down"
                              size={20}
                              color="#FFFFFF"
                           />
                        </View>
                        <Text className="text-sm font-bold text-primary_green">
                           23% price drop
                        </Text>
                     </View>

                     <Text className="text-xl font-bold text-[#111827] mb-2">
                        Dairy Products
                     </Text>
                     <Text className="text-sm text-gray-600 mb-6">
                        Average savings of $2.40 across milk, cheese, and yogurt
                     </Text>

                     <Pressable className="flex-row items-center gap-2">
                        <Text className="text-sm text-primary_green font-semibold">
                           View all dairy deals
                        </Text>
                        <FontAwesome6
                           name="arrow-right"
                           size={14}
                           className="text-primary_green"
                        />
                     </Pressable>
                  </View>
               </Pressable>

               {/* Household Essentials */}
               <Pressable className="flex-1">
                  <View className="bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20 rounded-2xl p-8 hover:shadow-lg transition-all">
                     <View className="flex-row items-center justify-between mb-6">
                        <View className="w-14 h-14 bg-gradient-to-br from-accent to-orange-400 rounded-xl flex items-center justify-center shadow-md">
                           <FontAwesome6 name="fire" size={20} color="#FFFFFF" />
                        </View>
                        <Text className="text-sm font-bold text-accent">
                           Hot deals
                        </Text>
                     </View>

                     <Text className="text-xl font-bold text-[#111827] mb-2">
                        Household Essentials
                     </Text>
                     <Text className="text-sm text-gray-600 mb-6">
                        Bulk deals on cleaning supplies and paper products
                     </Text>

                     <Pressable className="flex-row items-center gap-2">
                        <Text className="text-sm text-accent font-semibold">
                           Explore household
                        </Text>
                        <FontAwesome6
                           name="arrow-right"
                           size={14}
                           className="text-accent"
                        />
                     </Pressable>
                  </View>
               </Pressable>

               {/* Fresh Produce */}
               <Pressable className="flex-1">
                  <View className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-8 hover:shadow-lg transition-all">
                     <View className="flex-row items-center justify-between mb-6">
                        <View className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                           <FontAwesome6
                              name="chart-line"
                              size={20}
                              color="#FFFFFF"
                           />
                        </View>
                        <Text className="text-sm font-bold text-blue-600">
                           Price watch
                        </Text>
                     </View>

                     <Text className="text-xl font-bold text-[#111827] mb-2">
                        Fresh Produce
                     </Text>
                     <Text className="text-sm text-gray-600 mb-6">
                        Seasonal fruits and vegetables at best prices
                     </Text>

                     <Pressable className="flex-row items-center gap-2">
                        <Text className="text-sm text-blue-600 font-semibold">
                           Check fresh produce
                        </Text>
                        <FontAwesome6
                           name="arrow-right"
                           size={14}
                           className="text-blue-600"
                        />
                     </Pressable>
                  </View>
               </Pressable>
            </View>
         </View>
      </View>
   );
}
