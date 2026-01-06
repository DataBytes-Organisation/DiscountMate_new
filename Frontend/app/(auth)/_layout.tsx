import React from "react";
import { View, ScrollView } from "react-native";
import { Slot } from "expo-router";

export default function AuthLayout() {
   return (
      <View className="flex-1 bg-white">
         <ScrollView className="flex-1">
            <Slot />
         </ScrollView>
      </View>
   );
}
