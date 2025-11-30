import React from "react";
import { View, Text, Pressable } from "react-native";

export default function PriceAlertsSection() {
   return (
      <View className="bg-[#F9FAFB] border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">

            <Text className="text-2xl font-bold text-[#111827] mb-4">
               Price Alerts & Notifications
            </Text>
            <Text className="text-sm text-gray-600 mb-8">
               Receive alerts when prices drop for your favourite products
            </Text>

            <View className="rounded-2xl border border-gray-200 p-6 bg-white shadow-sm">
               <Text className="text-lg font-semibold text-[#111827] mb-4">
                  Active Alerts
               </Text>

               <View className="space-y-4">

                  {/* Alert item */}
                  <View className="flex-row justify-between items-center p-4 border border-gray-200 rounded-xl bg-gray-50">
                     <View>
                        <Text className="text-sm font-semibold text-[#111827]">
                           Coffee Beans 1kg
                        </Text>
                        <Text className="text-xs text-gray-600">Target Price: $21.00</Text>
                     </View>
                     <Pressable className="px-4 py-2 rounded-lg bg-gray-200">
                        <Text className="text-xs text-gray-700">Edit</Text>
                     </Pressable>
                  </View>

               </View>

               <Pressable className="mt-6 py-3 rounded-xl bg-[#10B981]">
                  <Text className="text-sm text-white text-center font-semibold">
                     Create Alert
                  </Text>
               </Pressable>
            </View>

         </View>
      </View>
   );
}
