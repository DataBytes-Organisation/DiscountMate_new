import React from "react";
import { View, Text, Pressable } from "react-native";

type Props = {
   name: string;
   subtitle: string;
   badge: string;
   badgeTone: "accent";
   trendLabel: string;
   trendTone: "green" | "red" | "orange" | "neutral";
};

export default function ProductCard({
   name,
   subtitle,
   badge,
   trendLabel,
   trendTone,
}: Props) {
   const trendColor =
      trendTone === "green"
         ? "text-[#10B981]"
         : trendTone === "red"
            ? "text-red-500"
            : trendTone === "orange"
               ? "text-orange-500"
               : "text-gray-500";

   return (
      <View className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
         {/* top */}
         <View className="flex-row mb-4">
            <View className="w-24 h-24 rounded-xl bg-gray-100 mr-4 items-center justify-center">
               <Text className="text-2xl text-gray-400">🛒</Text>
            </View>
            <View className="flex-1">
               <Text className="text-base font-bold text-[#111827]" numberOfLines={1}>
                  {name}
               </Text>
               <Text className="text-xs text-gray-500 mb-3">{subtitle}</Text>
               <View className="flex-row flex-wrap items-center">
                  <View className="px-3 py-1 rounded-full bg-[#FBBF241A] mr-2 mb-1">
                     <Text className="text-[11px] font-bold text-[#F59E0B]">
                        {badge}
                     </Text>
                  </View>
                  <Text className={`text-[11px] font-medium ${trendColor}`}>
                     {trendLabel}
                  </Text>
               </View>
            </View>
         </View>

         {/* retailer grid simplified */}
         <View className="border-t border-gray-100 pt-4 mb-4">
            <View className="flex-row justify-between">
               <View className="flex-1 mr-2 p-2 rounded-lg bg-gray-50 items-center">
                  <Text className="text-[11px] text-gray-500 mb-1">Coles</Text>
                  <Text className="text-base font-bold text-[#111827]">$3.80</Text>
               </View>
               <View className="flex-1 mr-2 p-2 rounded-lg bg-gray-50 items-center">
                  <Text className="text-[11px] text-gray-500 mb-1">Woolworths</Text>
                  <Text className="text-base font-bold text-[#111827]">$4.20</Text>
               </View>
               <View className="flex-1 p-2 rounded-lg bg-[#ECFDF5] border border-[#10B9814D] items-center">
                  <Text className="text-[11px] text-gray-500 mb-1">Aldi</Text>
                  <Text className="text-base font-bold text-[#10B981]">$3.50</Text>
                  <View className="mt-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669]">
                     <Text className="text-[10px] font-bold text-white">Cheapest</Text>
                  </View>
               </View>
            </View>
         </View>

         {/* actions */}
         <View className="flex-row items-center">
            <Pressable className="flex-1 mr-2 py-2.5 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669]">
               <Text className="text-sm font-semibold text-white text-center">
                  Add
               </Text>
            </Pressable>
            <Pressable className="px-3 py-2.5 rounded-xl border-2 border-gray-200 mr-2">
               <Text className="text-sm text-gray-600">📋</Text>
            </Pressable>
            <Pressable className="px-3 py-2.5 rounded-xl border-2 border-gray-200">
               <Text className="text-sm text-gray-600">🔔</Text>
            </Pressable>
         </View>
      </View>
   );
}
