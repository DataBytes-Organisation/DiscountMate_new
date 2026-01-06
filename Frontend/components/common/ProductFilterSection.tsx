import React from "react";
import { View, Text, Pressable } from "react-native";

interface ProductFilterSectionProps {
   productCount?: number;
   sortLabel?: string;
}

export default function ProductFilterSection({
   productCount = 0,
   sortLabel = "Best Savings",
}: ProductFilterSectionProps) {
   return (
      <View className="flex-row items-center justify-between mb-6">
         <View className="flex-row items-center" style={{ gap: 16 }}>
            {/* Add Filters button */}
            <Pressable className="flex-row items-center px-5 py-2.5 rounded-xl border-2 border-gray-200 bg-white">
               <Text className="mr-2 text-base">⚙️</Text>
               <Text className="text-sm font-medium text-gray-700">
                  Add Filters
               </Text>
            </Pressable>

            {/* Showing count */}
            <Text className="text-sm text-gray-600">
               Showing{" "}
               <Text className="font-semibold text-[#0DAD79]">{productCount}</Text>{" "}
               products
            </Text>
         </View>

         {/* Sort dropdown (static for now) */}
         <Pressable className="flex-row items-center px-5 py-2.5 rounded-xl border-2 border-gray-200 bg-white">
            <Text className="text-sm font-medium text-gray-700">
               Sort by: {sortLabel}
            </Text>
            <Text className="ml-2 text-xs text-gray-400">⌄</Text>
         </Pressable>
      </View>
   );
}
