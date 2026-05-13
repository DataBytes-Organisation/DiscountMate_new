import React from "react";
import { View } from "react-native";
import SidebarCategories from "./SidebarCategories";
import ProductGrid from "./ProductGrid";

export default function HomeMainSection() {
   // Home page always shows "All" category
   const activeCategory = "All";

   return (
      <View className="bg-[#F9FAFB]">
         <View className="w-full flex-row items-start">
            {/* Sidebar with navigation enabled */}
            <SidebarCategories
               activeCategory={activeCategory}
               useNavigation={true}
            />

            {/* Product area */}
            <View className="flex-1 px-4 md:px-8 py-8">
               <ProductGrid activeCategory={activeCategory} />
            </View>
         </View>
      </View>
   );
}
