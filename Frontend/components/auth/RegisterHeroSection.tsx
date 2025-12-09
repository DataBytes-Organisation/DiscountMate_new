import React from "react";
import { View, Text } from "react-native";

export default function RegisterHeroSection() {
   return (
      <View className="items-center mb-8 mt-4 px-4">
         {/* Breadcrumb or small label */}
         <Text className="text-xs font-semibold text-emerald-600 mb-2">
            Join 45,000+ Smart Shoppers
         </Text>

         {/* Main Title */}
         <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
            Join DiscountMate Today
         </Text>

         {/* Subtitle */}
         <Text className="text-sm text-gray-500 text-center leading-5 max-w-[320px]">
            Your all-in-one platform for comparing grocery prices, tracking savings,
            and finding the best deals across major retailers.
         </Text>
      </View>
   );
}
