import React from "react";
import { View, Text } from "react-native";

export default function HomeHeroStats() {
   return (
      <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
         <Text className="text-lg font-semibold text-[#111827] mb-1">
            Your Shopping Overview
         </Text>
         <Text className="text-sm text-gray-500 mb-4">
            Track your savings, baskets, and price alerts in one place.
         </Text>

         <View className="flex-row justify-between">
            <View>
               <Text className="text-xs text-gray-500">Total Saved</Text>
               <Text className="text-xl font-bold text-[#047857]">$487.60</Text>
            </View>
            <View>
               <Text className="text-xs text-gray-500">Shopping Trips</Text>
               <Text className="text-xl font-semibold text-[#111827]">23</Text>
            </View>
            <View>
               <Text className="text-xs text-gray-500">Active Alerts</Text>
               <Text className="text-xl font-semibold text-[#111827]">8</Text>
            </View>
         </View>
      </View>
   );
}
