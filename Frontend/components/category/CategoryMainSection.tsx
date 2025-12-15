import React, { useState } from "react";
import { View } from "react-native";
import SidebarCategories from "../home/SidebarCategories";
import ProductGrid from "../home/ProductGrid";
import CategoryTitleSection from "../common/CategoryTitleSection";

interface CategoryMainSectionProps {
   categoryId?: string | string[];
}

export default function CategoryMainSection({ categoryId }: CategoryMainSectionProps) {
   const [activeCategory, setActiveCategory] = useState<string>(
      typeof categoryId === "string" ? categoryId : "All"
   );

   // Get category name from id (map this to actual category data later)
   const categoryName =
      typeof categoryId === "string" ? categoryId : activeCategory || "Category";

   return (
      <View className="bg-[#F9FAFB]">
         <View className="w-full max-w-[1920px] mx-auto flex-row">
            {/* Sidebar */}
            <SidebarCategories
               activeCategory={activeCategory}
               onSelect={setActiveCategory}
            />

            {/* Product area */}
            <View className="flex-1 px-4 md:px-8 py-8">
               {/* Category Title Section */}
               <CategoryTitleSection categoryName={categoryName} />

               {/* Product Grid */}
               <ProductGrid activeCategory={activeCategory} />
            </View>
         </View>
      </View>
   );
}
