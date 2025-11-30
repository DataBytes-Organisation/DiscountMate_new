import React from "react";
import { View, Text, Pressable, Image } from "react-native";

export default function Header() {
   return (
      <View className="bg-white shadow-sm">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-4 border-b border-gray-100 flex-row items-center justify-between">
            {/* Left: logo + nav */}
            <View className="flex-row items-center space-x-6">
               <View className="flex-row items-center space-x-2">
                  <View className="w-11 h-11 rounded-lg items-center justify-center bg-gradient-to-br from-[#10B981] to-[#059669] shadow-md" />
                  <Text className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#10B981] to-[#059669]">
                     DiscountMate
                  </Text>
               </View>

               <View className="hidden md:flex flex-row items-center space-x-1">
                  <Pressable className="px-4 py-2 rounded-lg bg-[#10B9811A]">
                     <Text className="text-sm font-semibold text-[#10B981]">Home</Text>
                  </Pressable>
                  <Pressable className="px-4 py-2 rounded-lg">
                     <Text className="text-sm text-gray-600">Compare</Text>
                  </Pressable>
                  <Pressable className="px-4 py-2 rounded-lg">
                     <Text className="text-sm text-gray-600">Specials</Text>
                  </Pressable>
                  <Pressable className="px-4 py-2 rounded-lg">
                     <Text className="text-sm text-gray-600">My Lists</Text>
                  </Pressable>
                  <Pressable className="px-4 py-2 rounded-lg">
                     <Text className="text-sm text-gray-600">Profile</Text>
                  </Pressable>
               </View>
            </View>

            {/* Right: bell + basket summary + avatar */}
            <View className="flex-row items-center space-x-4">
               <Pressable className="relative">
                  <View className="w-6 h-6 rounded-full items-center justify-center">
                     <Text className="text-lg text-gray-600">🔔</Text>
                  </View>
                  <View className="w-2 h-2 rounded-full bg-red-500 absolute -top-0.5 -right-0.5" />
               </Pressable>

               <View className="flex-row items-center space-x-2 px-4 py-2.5 rounded-xl border border-[#10B98133] bg-[#10B9811A]">
                  <Text className="text-xs font-semibold text-gray-800">3 items</Text>
                  <Text className="text-xs font-bold text-[#10B981]">$12.40 saved</Text>
               </View>

               <Image
                  source={{
                     uri: "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg",
                  }}
                  className="w-10 h-10 rounded-full border-2 border-[#10B9814D]"
               />
            </View>
         </View>
      </View>
   );
}
