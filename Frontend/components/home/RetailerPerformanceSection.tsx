import React from "react";
import { View, Text } from "react-native";

export default function RetailerPerformanceSection() {
   return (
      <View className="bg-[#F9FAFB] border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">

            <Text className="text-2xl font-bold text-[#111827] mb-6">
               Retailer Performance
            </Text>

            <View className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
               <View className="flex-row justify-between p-4 border-b border-gray-200">
                  <Text className="text-sm font-semibold text-gray-700 flex-1">Store</Text>
                  <Text className="text-sm font-semibold text-gray-700 flex-1">Avg Price</Text>
                  <Text className="text-sm font-semibold text-gray-700 flex-1">Items Tracked</Text>
                  <Text className="text-sm font-semibold text-gray-700 flex-1">Trend</Text>
               </View>

               {[
                  ["Coles", "$3.80", "145 items", "↑ 1.2%"],
                  ["Woolworths", "$3.90", "142 items", "↑ 0.8%"],
                  ["Aldi", "$3.45", "130 items", "↓ 0.4%"],
               ].map(([store, price, items, trend], index) => (
                  <View
                     key={store}
                     className={`flex-row justify-between p-4 ${index < 2 ? "border-b border-gray-200" : ""
                        }`}
                  >
                     <Text className="flex-1 text-sm text-gray-700">{store}</Text>
                     <Text className="flex-1 text-sm text-gray-700">{price}</Text>
                     <Text className="flex-1 text-sm text-gray-700">{items}</Text>
                     <Text className="flex-1 text-sm text-gray-700">{trend}</Text>
                  </View>
               ))}
            </View>

         </View>
      </View>
   );
}
