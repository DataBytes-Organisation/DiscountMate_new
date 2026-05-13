import React from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

interface ProductSmartInsightsProps {
   productId?: string | string[];
}

export default function ProductSmartInsights({
   productId,
}: ProductSmartInsightsProps) {
   return (
      <View className="bg-blue-50 rounded-3xl px-6 py-6 mt-6">
         {/* Header */}
         <View className="flex-row items-center gap-4 mb-2">
            <View className="w-10 h-10 rounded-2xl bg-indigo-500 items-center justify-center">
               <FontAwesome6 name="lightbulb" size={18} color="#FFFFFF" />
            </View>
            <View>
               <Text className="text-xl font-bold text-gray-900">
                  Smart Price Insights
               </Text>
               <Text className="text-sm text-gray-600 mt-1">
                  AI-powered predictions based on historical data and market trends
               </Text>
            </View>
         </View>

         {/* Card 1: Price Trend */}
         <View className="mt-5 bg-white rounded-2xl px-5 py-4 border-l-4 border-primary_green">
            <View className="flex-row items-center gap-3 mb-2">
               <View className="w-8 h-8 rounded-xl bg-primary_green/10 items-center justify-center">
                  <FontAwesome6
                     name="arrow-trend-down"
                     size={16}
                     color="#16A34A"
                  />
               </View>
               <Text className="text-base font-semibold text-gray-900">
                  Price Trend: Decreasing
               </Text>
            </View>

            <Text className="text-sm text-gray-700 mb-3">
               Prices have dropped 18% in the last 14 days across all retailers. This
               is a good time to buy.
            </Text>

            <View className="flex-row items-center gap-3">
               <View className="px-3 py-1 rounded-full bg-primary_green">
                  <Text className="text-[11px] font-semibold text-white">
                     High Confidence
                  </Text>
               </View>
               <Text className="text-[11px] text-gray-500">
                  Based on 90 days of data
               </Text>
            </View>
         </View>

         {/* Card 2: Next Expected Price Drop */}
         <View className="mt-4 bg-white rounded-2xl px-5 py-4">
            <View className="flex-row items-center gap-3 mb-2">
               <View className="w-8 h-8 rounded-xl bg-emerald-50 items-center justify-center">
                  <FontAwesome6 name="calendar-days" size={16} color="#16A34A" />
               </View>
               <Text className="text-base font-semibold text-gray-900">
                  Next Expected Price Drop
               </Text>
            </View>

            <Text className="text-sm text-gray-700 mb-3">
               Based on historical patterns, the next major price drop is predicted
               around March 15, 2025 (in 12 days).
            </Text>

            <Pressable className="bg-primary_green rounded-xl px-4 py-2 self-start">
               <Text className="text-sm font-semibold text-white">
                  Set Price Alert
               </Text>
            </Pressable>
         </View>

         {/* Card 3: Savings Opportunity */}
         <View className="mt-4 bg-white rounded-2xl px-5 py-4 mb-1">
            <View className="flex-row items-center gap-3 mb-2">
               <View className="w-8 h-8 rounded-xl bg-emerald-50 items-center justify-center">
                  <FontAwesome6 name="percent" size={14} color="#16A34A" />
               </View>
               <Text className="text-base font-semibold text-gray-900">
                  Savings Opportunity
               </Text>
            </View>

            <Text className="text-sm text-gray-700">
               Current price is 26% below the 90-day average. You are getting an
               excellent deal right now.
            </Text>
         </View>
      </View>
   );
}
