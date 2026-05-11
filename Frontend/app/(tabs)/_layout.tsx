import React from "react";
import { View, ScrollView } from "react-native";
import { Slot, useSegments } from "expo-router";
import AppHeader from "../../components/layout/Header";
import SearchBar from "../../components/layout/SearchBar";
export default function TabsLayout() {
   const segments = useSegments();
   const isDashboardPage = segments.includes("dashboard");
   const isProfilePage = segments.includes("profile");
   const isNotificationsPage = segments.includes("notifications");
   const isAlertSegmentsPage = segments.includes("alert-segments");
   const isSubscriptionPage = segments.includes("subscription");
   const isSupportPage = segments.includes("contact");
   const isPrivacyTermsPage = segments.includes("privacy-terms");
   const isComparePage = segments.includes("compare");
   const isMyListsPage = segments.includes("my-lists");
   const isProductDashboardPage = segments.includes("product-dashboard");

   let activeRoute: "Home" | "Compare" | "Specials" | "Grocery Lists" | "Profile" | "Dashboard" = "Home";
   if (
      isProfilePage ||
      isNotificationsPage ||
      isAlertSegmentsPage ||
      isSubscriptionPage ||
      isSupportPage ||
      isPrivacyTermsPage
   ) {
      activeRoute = "Profile";
   } else if (isComparePage) {
      activeRoute = "Compare";
   } else if (isMyListsPage) {
      activeRoute = "Grocery Lists";
   } else if (isDashboardPage || isProductDashboardPage) {
      activeRoute = "Dashboard";
   }

   return (
      <View className="flex-1 bg-[#F3F4F6]">
         <AppHeader activeRoute={activeRoute} />
         {!isProfilePage &&
            !isNotificationsPage &&
            !isAlertSegmentsPage &&
            !isSubscriptionPage &&
            !isSupportPage &&
            !isPrivacyTermsPage &&
            !isComparePage &&
            !isMyListsPage &&
            !isDashboardPage &&
            !isProductDashboardPage && (
            <View className="mb-1">
               <SearchBar />
            </View>
         )}

         {isComparePage || isMyListsPage ? (
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
   );
}
