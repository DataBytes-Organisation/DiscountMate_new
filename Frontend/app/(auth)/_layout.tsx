import React from "react";
import { View, ScrollView } from "react-native";
import { Slot } from "expo-router";
import AppHeader from "../../components/layout/Header";

export default function AuthLayout() {
   return (
      <View className="flex-1 bg-white">
         <AppHeader />
         <ScrollView className="flex-1">
            <Slot />
         </ScrollView>
      </View>
   );
}
