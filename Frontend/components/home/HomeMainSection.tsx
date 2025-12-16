import React, { useState } from "react";
import { View } from "react-native";
import SidebarCategories from "./SidebarCategories";
import ProductGrid from "./ProductGrid";

export default function HomeMainSection() {
   const [activeCategory, setActiveCategory] = useState<string>("All");

   return (
      <View className="bg-[#F9FAFB]">
         <View className="w-full flex-row items-start">
            {/* Sidebar */}
            <SidebarCategories
               activeCategory={activeCategory}
               onSelect={setActiveCategory}
            />

            {/* Product area */}
            <View className="flex-1 px-4 md:px-8 py-8">
               <ProductGrid activeCategory={activeCategory} />
            </View>
         </View>
      </View>
   );
}
