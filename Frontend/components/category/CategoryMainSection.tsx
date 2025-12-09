import React from "react";
import { View } from "react-native";
import SidebarCategories from "../home/SidebarCategories";
import ProductGrid from "../home/ProductGrid";
import CategoryTitleSection from "../common/CategoryTitleSection";

interface CategoryMainSectionProps {
   categoryId?: string | string[];
}

export default function CategoryMainSection({ categoryId }: CategoryMainSectionProps) {
   // Get category name from id (map this to actual category data later)
   const categoryName = typeof categoryId === "string" ? categoryId : "Category";

   return (
      <View className="bg-[#F9FAFB]">
         <View className="w-full max-w-[1920px] mx-auto flex-row">
            {/* Sidebar */}
            <SidebarCategories />

            {/* Product area */}
            <View className="flex-1 px-4 md:px-8 py-8">
               {/* Category Title Section */}
               <CategoryTitleSection categoryName={categoryName} />

               {/* Product Grid */}
               <ProductGrid />
            </View>
         </View>
      </View>
   );
}
