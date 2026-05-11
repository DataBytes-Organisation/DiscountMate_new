import React from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

type ActiveListBannerProps = {
   listName: string;
   onPressChange?: () => void;
};

export default function ActiveListBanner({ listName, onPressChange }: ActiveListBannerProps) {
   return (
      <View className="flex-row items-center justify-between rounded-2xl border border-primary_green/25 bg-gradient-to-r from-primary_green/10 to-secondary_green/5 px-4 py-3 mb-5">
         <View className="flex-row items-center gap-3 flex-1">
            <View className="w-10 h-10 rounded-xl bg-primary_green/15 items-center justify-center">
               <FontAwesome6 name="check-double" size={16} color="#059669" />
            </View>
            <View className="flex-1">
               <Text className="text-xs font-semibold text-primary_green uppercase tracking-wide">
                  Active list (app-wide)
               </Text>
               <Text className="text-base font-bold text-gray-900 mt-0.5" numberOfLines={1}>
                  {listName}
               </Text>
               <Text className="text-xs text-gray-600 mt-0.5">
                  New items will target this list once checkout is connected.
               </Text>
            </View>
         </View>
         {onPressChange ? (
            <Pressable
               onPress={onPressChange}
               className="px-3 py-2 rounded-xl bg-white border border-gray-200"
            >
               <Text className="text-sm font-semibold text-gray-800">Choose</Text>
            </Pressable>
         ) : null}
      </View>
   );
}
