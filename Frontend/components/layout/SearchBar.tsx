import React, { useState } from "react";
import { View, TextInput, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useRouter } from "expo-router";

export default function SearchBar() {
   const [isFocused, setIsFocused] = useState(false);
   const [searchQuery, setSearchQuery] = useState("");
   const router = useRouter();

   const handleSearch = () => {
      if (searchQuery.trim().length > 0) {
         router.push(`/search?query=${encodeURIComponent(searchQuery.trim())}`);
      }
   };

   return (
      <View className="bg-white border-b border-gray-100 sticky top-[128px] z-40 shadow-sm">
         <View className="w-full px-4 md:px-8 py-6">
            <View className="flex-row items-center gap-4">
               {/* Search input */}
               <View
                  className={[
                     "flex-1 relative rounded-xl border-2 bg-white",
                     isFocused
                        ? "border-primary_green shadow-[0_0_0_3px_rgba(16,185,129,0.25)]"
                        : "border-gray-200",
                  ].join(" ")}
               >
                  <FontAwesome6
                     name="magnifying-glass"
                     size={16}
                     className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <TextInput
                     placeholder="Search for products, brands, or categories..."
                     placeholderTextColor="#9CA3AF"
                     className="w-full pl-14 pr-4 py-4 text-base text-[#111827] focus:outline-none focus:ring-0"
                     value={searchQuery}
                     onChangeText={setSearchQuery}
                     onFocus={() => setIsFocused(true)}
                     onBlur={() => setIsFocused(false)}
                     onSubmitEditing={handleSearch}
                     returnKeyType="search"
                  />
               </View>

               {/* Search button */}
               <Pressable
                  className="px-8 py-4 bg-gradient-to-r from-primary_green to-secondary_green rounded-xl shadow-sm hover:shadow-lg transition-shadow"
                  onPress={handleSearch}
               >
                  <Text className="text-white font-semibold">Search</Text>
               </Pressable>
            </View>
         </View>
      </View>
   );
}
