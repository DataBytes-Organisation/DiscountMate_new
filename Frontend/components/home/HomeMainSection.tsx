import React from "react";
import { View } from "react-native";
import SidebarCategories from "./SidebarCategories";
import ProductGrid from "./ProductGrid";

export default function HomeMainSection() {
   return (
      <View className="bg-[#F9FAFB]">
         <View className="w-full max-w-[1920px] mx-auto flex-row">
            {/* Sidebar */}
            <SidebarCategories />

            {/* Product area */}
            <View className="flex-1 px-4 md:px-8 py-8">
               <ProductGrid />
            </View>
         </View>
      </View>
   );
}
