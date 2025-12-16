import React from "react";
import { View, ScrollView } from "react-native";
import { Slot, useSegments } from "expo-router";
import AppHeader from "../../components/layout/Header";
import CategoryTabs from "../../components/layout/CategoryTabs";
import SearchBar from "../../components/layout/SearchBar";

export default function TabsLayout() {
   const segments = useSegments();
   const isProfilePage = segments.includes("profile");
   const activeRoute = isProfilePage ? "Profile" : "Home";

   return (
      <View className="flex-1 bg-[#F3F4F6]">
         <AppHeader activeRoute={activeRoute} />
         <CategoryTabs />
         {!isProfilePage && (
            <View className="mb-1">
               <SearchBar />
            </View>
         )}

         <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 24 }}
         >
            <Slot />
         </ScrollView>
      </View>
   );
}
