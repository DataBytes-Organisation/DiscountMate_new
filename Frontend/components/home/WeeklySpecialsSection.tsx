import React from "react";
import { View, Text, Pressable } from "react-native";
import AddButton from "../common/AddButton";

export default function WeeklySpecialsSection() {
   return (
      <View className="bg-white border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">

            <View className="flex-row justify-between items-center mb-8">
               <Text className="text-2xl font-bold text-[#111827]">
                  This Week’s Top Specials
               </Text>
               <Pressable>
                  <Text className="text-sm text-[#10B981] font-semibold">
                     View all specials →
                  </Text>
               </Pressable>
            </View>

            <View className="flex-row flex-wrap -mx-3">
               {[1, 2, 3, 4].map((i) => (
                  <View key={i} className="w-full md:w-1/4 px-3 mb-6">
                     <View className="rounded-2xl border border-gray-200 p-5 bg-white shadow-sm">
                        <View className="w-full h-32 rounded-xl bg-gray-100 mb-4" />

                        <Text className="text-sm font-semibold text-[#111827] mb-1">
                           Premium Choc Biscuits 500g
                        </Text>

                        <Text className="text-sm text-[#10B981] font-bold">$7.99</Text>
                        <Text className="text-xs text-gray-500">Save $4.01</Text>

                        <View className="mt-4">
                           <AddButton label="Add to Basket" />
                        </View>

                     </View>
                  </View>
               ))}
            </View>
         </View>
      </View>
   );
}
