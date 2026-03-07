import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import SidebarCategories from "../home/SidebarCategories";
import ProductGrid from "../home/ProductGrid";
import CategoryTitleSection from "../common/CategoryTitleSection";
import { API_URL } from "@/constants/Api";

function toTitleCase(input: string): string {
   const s = input.trim();
   if (!s) return s;
   return s.toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase());
}

interface CategoryMainSectionProps {
   categoryId?: string | string[];
}

export default function CategoryMainSection({ categoryId }: CategoryMainSectionProps) {
   const categoryIdStr = useMemo(() => {
      if (!categoryId) return null;
      if (Array.isArray(categoryId)) return categoryId[0] || null;
      return categoryId;
   }, [categoryId]);

   const activeCategory = categoryIdStr || "All";
   const [categoryName, setCategoryName] = useState<string>("Category");

   useEffect(() => {
      let cancelled = false;
      async function loadCategory() {
         if (!categoryIdStr) {
            setCategoryName("All");
            return;
         }
         try {
            const res = await fetch(`${API_URL}/categories/${encodeURIComponent(categoryIdStr)}`);
            if (!res.ok) throw new Error(`Failed to fetch category (${res.status})`);
            const data = await res.json();
            const name = typeof data?.category_name === "string" ? data.category_name : "";
            if (!cancelled) setCategoryName(name ? toTitleCase(name) : "Category");
         } catch (e) {
            console.error("Failed to load category:", e);
            if (!cancelled) setCategoryName("Category");
         }
      }
      loadCategory();
      return () => {
         cancelled = true;
      };
   }, [categoryIdStr]);

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
               <ProductGrid activeCategory={categoryIdStr || undefined} />
            </View>
         </View>
      </View>
   );
}
