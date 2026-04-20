import React from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

type MyListsHeroSectionProps = {
   onCreate: () => void;
};

export default function MyListsHeroSection({ onCreate }: MyListsHeroSectionProps) {
   return (
      <View className="px-4 md:px-8 py-10 bg-white border-b border-gray-100">
         <View className="mb-6 items-center">
            <Text className="text-4xl font-bold text-gray-900 mb-2 text-center">My Lists</Text>
            <Text className="text-lg text-gray-600 text-center max-w-2xl">
               Create and organise lists, preview savings analytics.
            </Text>
         </View>
         <View className="flex-row flex-wrap items-center justify-center gap-3">
            <Pressable
               onPress={onCreate}
               className="flex-row items-center gap-2 px-6 py-3 rounded-2xl bg-primary_green"
            >
               <FontAwesome6 name="plus" size={14} color="#FFFFFF" />
               <Text className="text-base font-semibold text-white">New list</Text>
            </Pressable>
         </View>
      </View>
   );
}
