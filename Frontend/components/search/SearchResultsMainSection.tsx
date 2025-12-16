import React, { useState, useEffect } from "react";
import { View, Text } from "react-native";
import SidebarFilters from "./SidebarFilters";
import ProductGrid from "../home/ProductGrid";
import { useLocalSearchParams } from "expo-router";

export default function SearchResultsMainSection() {
   const { query } = useLocalSearchParams();
   const [searchQuery, setSearchQuery] = useState<string>("");
   const [filters, setFilters] = useState<{
      priceRange: { min: number | null; max: number | null };
      retailers: string[];
   }>({
      priceRange: { min: null, max: null },
      retailers: [],
   });

   useEffect(() => {
      if (typeof query === "string") {
         setSearchQuery(query);
      } else if (Array.isArray(query) && query.length > 0) {
         setSearchQuery(query[0]);
      }
   }, [query]);

   const handleFiltersChange = (newFilters: {
      priceRange: { min: number | null; max: number | null };
      retailers: string[];
   }) => {
      setFilters(newFilters);
      // TODO: Apply filters to search results
   };

   return (
      <View className="bg-[#F9FAFB]">
         <View className="w-full flex-row items-start">
            {/* Sidebar with Filters */}
            <SidebarFilters onFiltersChange={handleFiltersChange} />

            {/* Main Content Area */}
            <View className="flex-1 px-4 md:px-8 py-8">
               {/* Search Results Header */}
               <View className="mb-6">
                  <Text className="text-2xl font-bold text-gray-900 mb-2">
                     Search Results for "{searchQuery}"
                  </Text>
                  <Text className="text-sm text-gray-600">
                     723 results for {searchQuery}
                  </Text>
               </View>

               {/* Product Grid */}
               <ProductGrid activeCategory={undefined} searchQuery={searchQuery} />
            </View>
         </View>
      </View>
   );
}
