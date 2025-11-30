import React from "react";
import { View, TextInput, Text, Pressable } from "react-native";

export default function SearchBar() {
   return (
      <View className="bg-white border-b border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-6 flex-row items-center space-x-4">
            <View className="flex-1 flex-row items-center bg-white rounded-xl border-2 border-gray-200 px-3 py-2">
               <Text className="mr-2 text-gray-400 text-base">🔍</Text>
               <TextInput
                  placeholder="Search for products, brands, or categories..."
                  placeholderTextColor="#9CA3AF"
                  className="flex-1 text-sm text-[#111827] py-1"
               />
            </View>
            <Pressable className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669]">
               <Text className="text-sm font-semibold text-white">Search</Text>
            </Pressable>
         </View>
      </View>
   );
}
