import React, { useState, useEffect } from "react";
import { View, Text } from "react-native";
import SidebarFilters from "./SidebarFilters";
import ProductGrid from "../home/ProductGrid";
import ProductCard, { Product } from "../home/ProductCard";
import { useLocalSearchParams } from "expo-router";
import { REVERSE_IMAGE_SEARCH_API_URL } from "@/constants/Api";
import { ImageSearchResult, useImageSearch } from "../../app/(tabs)/ImageSearchContext";

function buildImageSearchImageUrl(imageUrl: string | null | undefined): string | null {
   if (!imageUrl) return null;

   const filename = imageUrl.split("/").pop();
   if (!filename) return null;

   return `${REVERSE_IMAGE_SEARCH_API_URL}/images/${encodeURIComponent(decodeURIComponent(filename))}`;
}

function mapImageResultToProduct(result: ImageSearchResult): Product {
   const parsePrice = (value: string | null): number => {
      if (!value) return 0;
      const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
      return Number.isNaN(parsed) ? 0 : parsed;
   };

   const priceNow = parsePrice(result.price_now);
   const priceWas = parsePrice(result.price_was);
   const savings = Math.max(0, priceWas - priceNow);

   return {
      id: result.product_id,
      name: result.name,
      subtitle: `Similarity: ${(result.similarity_score * 100).toFixed(1)}%`,
      icon: "tag",
      link_image: buildImageSearchImageUrl(result.image_url),
      badge: savings > 0 ? `Save $${savings.toFixed(2)}` : `${(result.similarity_score * 100).toFixed(0)}% Match`,
      trendLabel: "Visual match",
      trendTone: "neutral",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: priceNow > 0 ? `$${priceNow.toFixed(2)}` : "-",
            isCheapest: true,
            unitPriceLabel: result.price_comparable ?? undefined,
         },
         { storeKey: "woolworths", name: "Woolworths", price: "-", isCheapest: false },
         { storeKey: "iga", name: "IGA", price: "-", isCheapest: false },
      ],
   };
}

export default function SearchResultsMainSection() {
   const { query, imageSearch } = useLocalSearchParams();
   const isImageSearch = imageSearch === "true";
   const { results: imageResults } = useImageSearch();
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

   if (isImageSearch) {
      return (
         <View className="bg-[#F9FAFB]">
            <View className="w-full flex-row items-start">
               <SidebarFilters onFiltersChange={handleFiltersChange} />

               <View className="flex-1 px-4 md:px-8 py-8">
                  <View className="mb-6">
                     <Text className="text-2xl font-bold text-gray-900 mb-2">
                        Image Search Results
                     </Text>
                     <Text className="text-sm text-gray-600">
                        Showing visually similar Coles catalogue products
                     </Text>
                  </View>

                  {imageResults.length === 0 ? (
                     <View className="border border-dashed border-gray-200 rounded-2xl p-8 items-center justify-center bg-white">
                        <Text className="text-base font-semibold text-gray-700 mb-1">
                           No matches found.
                        </Text>
                        <Text className="text-sm text-gray-500">
                           Try uploading a clearer product photo.
                        </Text>
                     </View>
                  ) : (
                     <View className="flex-row flex-wrap -mx-2">
                        {imageResults.map((result) => (
                           <View key={result.product_id} className="w-full md:w-1/2 lg:w-1/3 px-2 mb-6">
                              <ProductCard product={mapImageResultToProduct(result)} />
                           </View>
                        ))}
                     </View>
                  )}
               </View>
            </View>
         </View>
      );
   }

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
                  requireSearch
               />
            </View>
         </View>
      </View>
   );
}
