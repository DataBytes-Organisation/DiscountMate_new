import React from "react";
import { View, Text } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

interface CategoryTitleSectionProps {
   categoryName?: string;
   subtitle?: string;
}

export default function CategoryTitleSection({
   categoryName = "Category",
   subtitle,
}: CategoryTitleSectionProps) {
   const formattedCategoryName = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
   const defaultSubtitle = `Compare prices across all major retailers for ${categoryName.toLowerCase()} essentials`;

   return (
      <View className="mb-6">
         {/* Category Header */}
         <View className="flex-row items-center mb-4">
            <View className="w-24 h-24 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 items-center justify-center flex-shrink-0">
               <FontAwesome6 name="box" size={20} color="#FFFFFF" />
            </View>
            <View className="ml-3">
               <Text className="text-3xl font-bold text-gray-800">
                  {formattedCategoryName}
               </Text>
               <Text className="text-base text-gray-600 mt-1">
                  {subtitle || defaultSubtitle}
               </Text>
            </View>
         </View>
      </View>
   );
}
