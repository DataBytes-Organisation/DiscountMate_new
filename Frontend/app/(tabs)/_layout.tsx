import React from "react";
import { View, ScrollView } from "react-native";
import { Slot, useSegments } from "expo-router";
import AppHeader from "../../components/layout/Header";
import CategoryTabs from "../../components/layout/CategoryTabs";
import SearchBar from "../../components/layout/SearchBar";
import { CartProvider } from "./CartContext";

export default function TabsLayout() {
   const segments = useSegments();
   const isProfilePage = segments.includes("profile");
   const isComparePage = segments.includes("compare");
   const isProductDashboardPage = segments.includes("product-dashboard");

   let activeRoute: "Home" | "Compare" | "Specials" | "My Lists" | "Profile" | "Dashboard" = "Home";
   if (isProfilePage) {
      activeRoute = "Profile";
   } else if (isComparePage) {
      activeRoute = "Compare";
   } else if (isProductDashboardPage) {
      activeRoute = "Dashboard";
   }

   return (
      <CartProvider>
         <View className="flex-1 bg-[#F3F4F6]">
            <AppHeader activeRoute={activeRoute} />
            <CategoryTabs />
            {!isProfilePage && !isComparePage && (
               <View className="mb-1">
                  <SearchBar />
               </View>
            )}

            {isComparePage ? (
               <Slot />
            ) : (
               <ScrollView
                  className="flex-1"
                  contentContainerStyle={{ paddingBottom: 24 }}
               >
                  <Slot />
               </ScrollView>
            )}
         </View>
      </CartProvider>
   );
}
