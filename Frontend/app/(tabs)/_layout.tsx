import React from "react";
import { View, ScrollView } from "react-native";
import { Slot } from "expo-router";
import AppHeader from "../../components/layout/Header";
import CategoryTabs from "../../components/layout/CategoryTabs";
import SearchBar from "../../components/layout/SearchBar";

export default function TabsLayout() {
   return (
      <View className="flex-1 bg-[#F3F4F6]">
         <AppHeader />
         <CategoryTabs />
         <View className="px-4 pb-3">
            <SearchBar />
         </View>

         <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
         >
            <Slot />
         </ScrollView>
      </View>
   );
}
