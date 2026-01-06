import React from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export default function AuthFooter() {
   return (
      <View className="mt-10 bg-dark px-6 pt-8 pb-6">
         <View className="w-full max-w-5xl self-center gap-5">
            <View className="flex-row items-center gap-3">
               <View className="h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary_green to-secondary_green shadow-md">
                  <FontAwesome6 name="tag" size={20} color="#FFFFFF" />
               </View>
               <View className="flex-1">
                  <Text className="text-white text-base font-semibold">
                     DiscountMate
                  </Text>
                  <Text className="text-[11px] text-gray-300 mt-[2px]">
                     Your smart shopping companion for finding the best grocery deals
                     across Australia&apos;s leading retailers.
                  </Text>
               </View>
            </View>

            <View className="h-px bg-white/10" />

            <View className="flex-row flex-wrap items-center justify-between gap-3">
               <Text className="text-[11px] text-gray-400">
                  © 2024 DiscountMate. All rights reserved.
               </Text>
               <View className="flex-row flex-wrap items-center gap-4">
                  {["Privacy", "Terms", "Support"].map((item) => (
                     <Pressable key={item}>
                        <Text className="text-[11px] text-gray-300">
                           {item}
                        </Text>
                     </Pressable>
                  ))}
               </View>
            </View>
         </View>
      </View>
   );
}

