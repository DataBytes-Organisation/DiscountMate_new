import React from "react";
import { View, ScrollView } from "react-native";
import { Slot, useSegments } from "expo-router";
import AppHeader from "../../components/layout/Header";
import SearchBar from "../../components/layout/SearchBar";
import { CartProvider } from "./CartContext";
import { UserProfileProvider } from "../../context/UserProfileContext";
import { NotificationCenterProvider } from "../../context/NotificationCenterContext";

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

   let activeRoute: "Home" | "Compare" | "Specials" | "My Lists" | "Profile" | undefined = "Home";
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
   } else if (isDashboardPage || isProductDashboardPage) {
      activeRoute = undefined;
   }

   return (
      <CartProvider>
         <UserProfileProvider>
            <NotificationCenterProvider>
               <View className="flex-1 bg-[#F3F4F6]">
                  <AppHeader activeRoute={activeRoute} />
                  {!isDashboardPage &&
                     !isProductDashboardPage &&
                     !isProfilePage &&
                     !isNotificationsPage &&
                     !isAlertSegmentsPage &&
                     !isSubscriptionPage &&
                     !isSupportPage &&
                     !isPrivacyTermsPage && <CategoryTabs />}
                  {!isProfilePage &&
                     !isNotificationsPage &&
                     !isAlertSegmentsPage &&
                     !isSubscriptionPage &&
                     !isSupportPage &&
                     !isPrivacyTermsPage &&
                     !isComparePage &&
                     !isDashboardPage &&
                     !isProductDashboardPage && (
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
            </NotificationCenterProvider>
         </UserProfileProvider>
      </CartProvider>
   );
}
