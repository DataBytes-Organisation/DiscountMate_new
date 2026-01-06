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
      if (typeof query === "string" && query.trim().length > 0) {
         setSearchQuery(query.trim());
      } else if (Array.isArray(query) && query.length > 0 && query[0]?.trim().length > 0) {
         setSearchQuery(query[0].trim());
      } else {
         setSearchQuery("");
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
               {searchQuery ? (
                  <View className="mb-6">
                     <Text className="text-2xl font-bold text-gray-900 mb-2">
                        Search Results for "{searchQuery}"
                     </Text>
                     <Text className="text-sm text-gray-600">
                        Results for {searchQuery}
                     </Text>
                  </View>
               ) : (
                  <View className="mb-6">
                     <Text className="text-2xl font-bold text-gray-900 mb-2">
                        Search Results
                     </Text>
                     <Text className="text-sm text-gray-600">
                        Enter a search query to see results
                     </Text>
                  </View>
               )}

               {/* Product Grid */}
               <ProductGrid
                  activeCategory={undefined}
                  searchQuery={searchQuery}
                  priceRangeFilter={filters.priceRange}
               />
            </View>
         </View>
      </View>
   );
}
