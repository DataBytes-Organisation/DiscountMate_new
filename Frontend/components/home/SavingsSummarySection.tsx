import React from "react";
import { View, Text } from "react-native";

export default function SavingsSummarySection() {
   return (
      <View className="bg-gradient-to-br from-[#F9FAFB] to-white border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
            <View className="bg-white border border-gray-200 rounded-2xl p-8 md:p-10">
               <View className="flex-row flex-wrap -mx-3">
                  <Stat value="$127.50" label="Total community savings today" />
                  <Stat value="2,847" label="Products tracked" />
                  <Stat value="18%" label="Average savings per shop" />
                  <Stat value="3" label="Major retailers compared" />
               </View>
            </View>
         </View>
      </View>
   );
}

function Stat({ value, label }: { value: string; label: string }) {
   return (
      <View className="w-full md:w-1/4 px-3 mb-8 md:mb-0">
         <Text className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#10B981] to-[#059669] text-center mb-2">
            {value}
         </Text>
         <Text className="text-sm text-gray-600 text-center font-medium">
            {label}
         </Text>
      </View>
   );
}
