import React from "react";
import { View, Text, Pressable } from "react-native";

export default function ComparisonToolsSection() {
   return (
      <View className="bg-white border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">

            <Text className="text-2xl font-bold text-[#111827] mb-4">
               Comparison Tools
            </Text>
            <Text className="text-sm text-gray-600 mb-8">
               Use advanced tools to compare products, baskets, and savings
            </Text>

            <View className="flex-row flex-wrap -mx-3">

               {/* Unit Price Calculator */}
               <View className="w-full md:w-1/3 px-3 mb-6">
                  <View className="rounded-2xl border border-gray-200 p-6 bg-white shadow-sm">
                     <Text className="text-lg font-semibold text-[#111827] mb-2">
                        Unit Price Calculator
                     </Text>
                     <Text className="text-sm text-gray-600 mb-4">
                        Compare cost per unit to find best value
                     </Text>
                     <Pressable className="px-4 py-3 rounded-xl bg-[#10B981]">
                        <Text className="text-sm text-white text-center font-semibold">
                           Open Tool
                        </Text>
                     </Pressable>
                  </View>
               </View>

               {/* Basket Optimizer */}
               <View className="w-full md:w-1/3 px-3 mb-6">
                  <View className="rounded-2xl border border-gray-200 p-6 bg-white shadow-sm">
                     <Text className="text-lg font-semibold text-[#111827] mb-2">
                        Basket Optimizer
                     </Text>
                     <Text className="text-sm text-gray-600 mb-4">
                        Find the cheapest way to shop your entire basket
                     </Text>
                     <Pressable className="px-4 py-3 rounded-xl bg-[#10B981]">
                        <Text className="text-sm text-white text-center font-semibold">
                           Compare Basket
                        </Text>
                     </Pressable>
                  </View>
               </View>

            </View>

         </View>
      </View>
   );
}
