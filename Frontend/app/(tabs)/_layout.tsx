import React from "react";
import { View, ScrollView } from "react-native";
import { Slot, useSegments } from "expo-router";
import AppHeader from "../../components/layout/Header";
import SearchBar from "../../components/layout/SearchBar";
import { CartProvider } from "./CartContext";
import RecipeBot from "./RecipeBot";
import FooterSection from "../../components/home/FooterSection";
import { layoutContentPaddingBottom, routeUsesLayoutFooter, routeUsesOwnScroll } from "../../components/layout/pageFooterPolicy";

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
   const isComparePowerBIPage = segments.includes("compare-powerbi");
   const isShoppingSessionPage = segments.includes("shopping-session");
   const isMyListsPage = segments.includes("my-lists");
   const isProductDashboardPage = segments.includes("product-dashboard");

   let activeRoute: "Home" | "Compare" | "Specials" | "Grocery Lists" | "Profile" = "Home";
   if (
      isProfilePage ||
      isNotificationsPage ||
      isAlertSegmentsPage ||
      isSubscriptionPage ||
      isSupportPage ||
      isPrivacyTermsPage
   ) {
      activeRoute = "Profile";
   } else if (isComparePage || isComparePowerBIPage || isShoppingSessionPage) {
      activeRoute = "Compare";
   } else if (isMyListsPage) {
      activeRoute = "Grocery Lists";
   }

   return (
      <CartProvider>
         <View className="flex-1 bg-[#F3F4F6]">
            <AppHeader activeRoute={activeRoute} />
            {!isProfilePage &&
               !isNotificationsPage &&
               !isAlertSegmentsPage &&
               !isSubscriptionPage &&
               !isSupportPage &&
               !isPrivacyTermsPage &&
               !isComparePage &&
               !isComparePowerBIPage &&
               !isShoppingSessionPage &&
               !isMyListsPage &&
               !isDashboardPage &&
               !isProductDashboardPage && (
               <View className="mb-1">
                  <SearchBar />
               </View>
            )}

            {routeUsesOwnScroll(segments) ? (
               <Slot />
            ) : (
               <ScrollView
                  className="flex-1"
                  contentContainerStyle={{ paddingBottom: layoutContentPaddingBottom(segments), flexGrow: 1 }}
               >
                  <Slot />
                  {routeUsesLayoutFooter(segments) ? <FooterSection disableEdgeOffset /> : null}
               </ScrollView>
            )}

            {/* Floating Recipe RAG chatbot — sits above the scroll
                container so it stays pinned to the viewport corner
                on every page in the (tabs) group. */}
            <RecipeBot />
         </View>
      </CartProvider>
   );
}
