import React from "react";
import { View } from "react-native";
import { Slot } from "expo-router";

export default function AuthLayout() {
   return (
      <View className="flex-1 bg-white">
         <Slot />
      </View>
   );
}
