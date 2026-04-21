import React from "react";
import { View, ScrollView } from "react-native";
import { Slot, useSegments } from "expo-router";
import AppHeader from "../../components/layout/Header";
import CategoryTabs from "../../components/layout/CategoryTabs";
import SearchBar from "../../components/layout/SearchBar";
import { CartProvider } from "./CartContext";
import { UserProfileProvider } from "../../context/UserProfileContext";

export default function TabsLayout() {
   const segments = useSegments();
   const isDashboardPage = segments.includes("dashboard");
   const isProfilePage = segments.includes("profile");
   const isComparePage = segments.includes("compare");
   const isProductDashboardPage = segments.includes("product-dashboard");

   let activeRoute: "Home" | "Compare" | "Specials" | "My Lists" | "Profile" | undefined = "Home";
   if (isProfilePage) {
      activeRoute = "Profile";
   } else if (isComparePage) {
      activeRoute = "Compare";
   } else if (isDashboardPage || isProductDashboardPage) {
      activeRoute = undefined;
   }

   return (
      <CartProvider>
         <UserProfileProvider>
            <View className="flex-1 bg-[#F3F4F6]">
               <AppHeader activeRoute={activeRoute} />
               {!isDashboardPage && !isProductDashboardPage && !isProfilePage && <CategoryTabs />}
               {!isProfilePage && !isComparePage && !isDashboardPage && !isProductDashboardPage && (
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
         </UserProfileProvider>
      </CartProvider>
   );
}
