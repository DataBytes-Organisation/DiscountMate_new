import React from "react";
import { View, Text } from "react-native";

const stats = [
   {
      value: "$127.50",
      label: "Total community savings today",
   },
   {
      value: "2,847",
      label: "Products tracked",
   },
   {
      value: "18%",
      label: "Average savings per shop",
   },
   {
      value: "3",
      label: "Major retailers compared",
   },
];

export default function SavingsSummarySection() {
   return (
      <View className="bg-gradient-to-br from-light to-white border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
            <View className="bg-white border border-gray-200 rounded-2xl p-10 shadow-lg">
               <View className="flex flex-col md:flex-row gap-8">
                  {stats.map((item) => (
                     <View key={item.label} className="flex-1 items-center text-center">
                        <Text className="text-5xl font-bold bg-gradient-to-r from-primary_green to-secondary_green bg-clip-text text-transparent mb-3">
                           {item.value}
                        </Text>
                        <Text className="text-sm text-gray-600 font-medium">
                           {item.label}
                        </Text>
                     </View>
                  ))}
               </View>
            </View>
         </View>
      </View>
   );
}
