import React from "react";
import { View } from "react-native";
import SidebarCategories from "./SidebarCategories";
import ProductGrid from "./ProductGrid";
import type { CatalogueSource } from "@/services/catalogue/types";

type HomeMainSectionProps = {source?: CatalogueSource; activeCategory?: string;};

export default function HomeMainSection({
   source = "mongo",
   activeCategory = "All",
}: HomeMainSectionProps) {
   return (
      <View className="bg-[#F9FAFB]">
         <View className="w-full flex-row items-start">
            <SidebarCategories
               source={source}
               activeCategory={activeCategory}
               useNavigation
            />

            <View className="flex-1 px-4 md:px-8 py-8">
               <ProductGrid
                  source={source}
                  activeCategory={activeCategory}
               />
            </View>
         </View>
      </View>
   );
}
