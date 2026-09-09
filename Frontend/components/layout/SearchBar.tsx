import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useRouter } from "expo-router";
import { useImageSearch } from "../../app/(tabs)/ImageSearchContext";
import { ProductImageScanner, type ImageSearchResult } from "./ProductImageScanner";

export default function SearchBar() {
   const [isFocused, setIsFocused] = useState(false);
   const [searchQuery, setSearchQuery] = useState("");
   const router = useRouter();
   const { setResults } = useImageSearch();

   const handleSearch = () => {
      const value = searchQuery.trim();
      if (value) router.push(`/search?query=${encodeURIComponent(value)}`);
   };

   const handleImageResults = (results: ImageSearchResult[]) => {
      setResults(results as any);
      router.push("/search?imageSearch=true");
   };

   return (
      <View className="sticky top-[128px] z-40 border-b border-gray-100 bg-white shadow-sm">
         <View className="w-full px-4 py-6 md:px-8">
            <View className="flex-row items-start gap-4">
               <View className={`relative flex-1 rounded-xl border-2 bg-white ${isFocused ? "border-primary_green" : "border-gray-200"}`}>
                  <FontAwesome6 name="magnifying-glass" size={16} color="#9CA3AF" style={{ position: "absolute", left: 20, top: 18 }} />
                  <TextInput
                     accessibilityLabel="Search products"
                     placeholder="Search for products, brands, or categories..."
                     placeholderTextColor="#9CA3AF"
                     className="w-full py-4 pl-14 pr-4 text-base text-gray-900 outline-none"
                     value={searchQuery}
                     onChangeText={setSearchQuery}
                     onFocus={() => setIsFocused(true)}
                     onBlur={() => setIsFocused(false)}
                     onSubmitEditing={handleSearch}
                     returnKeyType="search"
                  />
               </View>
               <ProductImageScanner onResults={handleImageResults} label="Search by image" square />
               <Pressable onPress={handleSearch} className="items-center rounded-xl bg-primary_green px-8 py-4 shadow-sm">
                  <Text className="font-semibold text-white">Search</Text>
               </Pressable>
            </View>
         </View>
      </View>
   );
}
