import React from "react";
import { View, ScrollView } from "react-native";
import { Slot, useSegments } from "expo-router";
import AppHeader from "../../components/layout/Header";
import SearchBar from "../../components/layout/SearchBar";
import Breadcrumbs from "../../components/layout/Breadcrumbs";
import { CartProvider } from "../(tabs)/CartContext";

export default function TabsLayout() {
   const segments = useSegments();

   // Determine if we're on a product page and extract info
   const isProductPage = segments.includes("product") && segments.length > 1;
   const productId = isProductPage ? segments[segments.length - 1] : undefined;

   return (
      <CartProvider>
         <View className="flex-1 bg-[#F3F4F6]">
            <AppHeader />
            <View className="mb-1">
               <SearchBar />
            </View>

            {/* Breadcrumbs - shown on product pages */}
            {isProductPage && (
               <Breadcrumbs
                  categoryName="Dairy"
                  productName="Milk Full Cream 2L"
               />
            )}

            <ScrollView
               className="flex-1"
               contentContainerStyle={isProductPage ? { paddingBottom: 24 } : { paddingHorizontal: 16, paddingBottom: 24 }}
            >
               <Slot />
            </ScrollView>
         </View>
      </CartProvider>
   );
}
