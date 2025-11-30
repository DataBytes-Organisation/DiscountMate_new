import React from "react";
import { View, Text, Pressable } from "react-native";

export default function SmartListsSection() {
   return (
      <View className="bg-white border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">

            <Text className="text-2xl font-bold text-[#111827] mb-4">
               Smart Shopping Lists
            </Text>
            <Text className="text-sm text-gray-600 mb-8">
               Create lists for quick shopping and auto-track savings
            </Text>

            <View className="flex-row flex-wrap -mx-3">

               {/* Create new list */}
               <View className="w-full md:w-1/3 px-3 mb-6">
                  <Pressable className="rounded-2xl border-2 border-gray-200 p-8 items-center justify-center bg-gray-50">
                     <Text className="text-4xl text-gray-500 mb-4">＋</Text>
                     <Text className="text-lg font-semibold text-gray-700">
                        Create New List
                     </Text>
                  </Pressable>
               </View>

               {/* Weekly Essentials List */}
               <View className="w-full md:w-1/3 px-3 mb-6">
                  <View className="rounded-2xl border border-gray-200 p-6 bg-white shadow-sm">
                     <Text className="text-lg font-bold text-[#111827] mb-2">
                        Weekly Essentials
                     </Text>
                     <Text className="text-sm text-gray-600 mb-4">
                        12 items • Save $7.50
                     </Text>
                     <Pressable className="px-4 py-3 rounded-xl bg-[#10B981]">
                        <Text className="text-sm text-white text-center font-semibold">
                           Open List
                        </Text>
                     </Pressable>
                  </View>
               </View>

               {/* Monthly Stock-up */}
               <View className="w-full md:w-1/3 px-3 mb-6">
                  <View className="rounded-2xl border border-gray-200 p-6 bg-white shadow-sm">
                     <Text className="text-lg font-bold text-[#111827] mb-2">
                        Monthly Stock-up
                     </Text>
                     <Text className="text-sm text-gray-600 mb-4">
                        9 items • Save $12.40
                     </Text>
                     <Pressable className="px-4 py-3 rounded-xl bg-[#10B981]">
                        <Text className="text-sm text-white text-center font-semibold">
                           Open List
                        </Text>
                     </Pressable>
                  </View>
               </View>

            </View>
         </View>
      </View>
   );
}
