import React, { useMemo } from "react";
import { View } from "react-native";
import SidebarCategories, { slugToCategoryLabel } from "../home/SidebarCategories";
import ProductGrid from "../home/ProductGrid";
import CategoryTitleSection from "../common/CategoryTitleSection";

interface CategoryMainSectionProps {
   categoryId?: string | string[];
}

export default function CategoryMainSection({ categoryId }: CategoryMainSectionProps) {
   // Convert URL slug to category label, using URL as source of truth
   const activeCategory = useMemo(() => {
      if (!categoryId || typeof categoryId !== "string") {
         return "All";
      }

      // Try to convert slug back to category label
      const categoryLabel = slugToCategoryLabel(categoryId);
      return categoryLabel || categoryId; // Fallback to raw value if not found
   }, [categoryId]);

   // Get category name for display (use the label)
   const categoryName = activeCategory;

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
               {/* Category Title Section */}
               <CategoryTitleSection categoryName={categoryName} />

               {/* Product Grid */}
               <ProductGrid activeCategory={activeCategory} />
            </View>
         </View>
      </View>
   );
}
