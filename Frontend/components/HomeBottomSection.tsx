import React from "react";
import { View, Text } from "react-native";

export default function HomeBottomSection() {
   return (
      <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
         <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-semibold text-[#111827]">
               This week&apos;s top specials
            </Text>
            <Text className="text-xs text-[#10B981] font-medium">
               View all specials
            </Text>
         </View>

         <View className="flex-row justify-between">
            <View className="w-[48%] bg-[#ECFDF5] rounded-xl p-3">
               <Text className="text-sm font-semibold text-[#047857]">
                  Dairy & fridge
               </Text>
               <Text className="text-xs text-[#065F46]">
                  Up to 40% off milk, yoghurt, and cheese.
               </Text>
            </View>
            <View className="w-[48%] bg-[#FEF3C7] rounded-xl p-3">
               <Text className="text-sm font-semibold text-[#92400E]">
                  Household essentials
               </Text>
               <Text className="text-xs text-[#92400E]">
                  Stock up on cleaners and paper goods.
               </Text>
            </View>
         </View>
      </View>
   );
}
