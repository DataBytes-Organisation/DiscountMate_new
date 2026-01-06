import React from "react";
import { View, Text } from "react-native";

export default function HomeProductGridPreview() {
   return (
      <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
         <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-semibold text-[#111827]">
               Smart shopping tools
            </Text>
            <Text className="text-xs text-[#10B981] font-medium">
               View all
            </Text>
         </View>

         <View className="flex-row justify-between">
            <View className="w-[48%] bg-[#F9FAFB] rounded-xl p-3">
               <Text className="text-sm font-semibold text-[#111827] mb-1">
                  Compare prices
               </Text>
               <Text className="text-xs text-gray-500">
                  See which retailer gives you the best basket total.
               </Text>
            </View>
            <View className="w-[48%] bg-[#F9FAFB] rounded-xl p-3">
               <Text className="text-sm font-semibold text-[#111827] mb-1">
                  Price alerts
               </Text>
               <Text className="text-xs text-gray-500">
                  Get notified when your staples drop in price.
               </Text>
            </View>
         </View>
      </View>
   );
}
