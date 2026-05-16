import React from "react";
import { View } from "react-native";
import { Slot } from "expo-router";
import AppHeader from "../../components/layout/Header";

export default function SpecialsLayout() {
   return (
      <View className="flex-1 bg-[#F3F4F6]">
         <AppHeader activeRoute="Specials" />
         <Slot />
      </View>
   );
}
