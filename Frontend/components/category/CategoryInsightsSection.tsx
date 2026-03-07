import React, { useEffect, useMemo, useState } from "react";
import { View, Text } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { API_URL } from "@/constants/Api";

function toTitleCase(input: string): string {
   const s = input.trim();
   if (!s) return s;
   return s.toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase());
}

interface CategoryInsightsSectionProps {
   categoryId?: string | string[];
}

export default function CategoryInsightsSection({
   categoryId,
}: CategoryInsightsSectionProps) {
   const categoryIdStr = useMemo(() => {
      if (!categoryId) return null;
      if (Array.isArray(categoryId)) return categoryId[0] || null;
      return categoryId;
   }, [categoryId]);

   const [categoryName, setCategoryName] = useState<string>("Category");

   useEffect(() => {
      let cancelled = false;
      async function loadCategory() {
         if (!categoryIdStr) {
            setCategoryName("Category");
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

   const formattedCategoryName = categoryName;

   return (
      <View className="bg-white border-t border-b border-gray-200">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-12">
            {/* Header */}
            <View className="mb-8">
               <Text className="text-3xl font-bold text-gray-900 mb-2">
                  {formattedCategoryName} Category Insights
               </Text>
               <Text className="text-base text-gray-600">
                  Understanding price trends and savings opportunities
               </Text>
            </View>

            {/* Insight Cards */}
            <View className="flex-row flex-wrap gap-4">
               {/* Card 1: Average Savings */}
               <View className="flex-1 min-w-[240px] bg-green-50 border border-green-200 rounded-2xl p-6">
                  <View className="flex-row items-start justify-between mb-4">
                     <View className="w-12 h-12 bg-green-100 rounded-xl items-center justify-center">
                        <FontAwesome6
                           name="chart-line"
                           size={20}
                           color="#16A34A"
                        />
                     </View>
                     <View className="px-2.5 py-1 bg-gray-200 rounded-full">
                        <Text className="text-xs text-gray-600 font-medium">
                           This week
                        </Text>
                     </View>
                  </View>
                  <Text className="text-3xl font-bold text-primary_green mb-2">
                     $23.50
                  </Text>
                  <Text className="text-sm text-gray-700">
                     Average savings per basket
                  </Text>
               </View>

               {/* Card 2: Price Drops */}
               <View className="flex-1 min-w-[240px] bg-green-50 border border-green-200 rounded-2xl p-6">
                  <View className="flex-row items-start justify-between mb-4">
                     <View className="w-12 h-12 bg-green-100 rounded-xl items-center justify-center">
                        <FontAwesome6
                           name="arrow-trend-down"
                           size={20}
                           color="#16A34A"
                        />
                     </View>
                     <View className="px-2.5 py-1 bg-gray-200 rounded-full">
                        <Text className="text-xs text-gray-600 font-medium">
                           Trending
                        </Text>
                     </View>
                  </View>
                  <Text className="text-3xl font-bold text-primary_green mb-2">
                     42
                  </Text>
                  <Text className="text-sm text-gray-700">
                     Products with price drops
                  </Text>
               </View>

               {/* Card 3: Hot Deals */}
               <View className="flex-1 min-w-[240px] bg-orange-50 border border-orange-200 rounded-2xl p-6">
                  <View className="flex-row items-start justify-between mb-4">
                     <View className="w-12 h-12 bg-orange-100 rounded-xl items-center justify-center">
                        <FontAwesome6 name="fire" size={20} color="#F97316" />
                     </View>
                     <View className="px-2.5 py-1 bg-gray-200 rounded-full">
                        <Text className="text-xs text-gray-600 font-medium">
                           Hot deals
                        </Text>
                     </View>
                  </View>
                  <Text className="text-3xl font-bold text-orange-500 mb-2">
                     28
                  </Text>
                  <Text className="text-sm text-gray-700">
                     Products over 30% off
                  </Text>
               </View>

               {/* Card 4: Best Retailer */}
               <View className="flex-1 min-w-[240px] bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
                  <View className="flex-row items-start justify-between mb-4">
                     <View className="w-12 h-12 bg-yellow-100 rounded-xl items-center justify-center">
                        <FontAwesome6 name="trophy" size={20} color="#CA8A04" />
                     </View>
                     <View className="px-2.5 py-1 bg-gray-200 rounded-full">
                        <Text className="text-xs text-gray-600 font-medium">
                           Leader
                        </Text>
                     </View>
                  </View>
                  <Text className="text-3xl font-bold text-gray-900 mb-2">
                     Aldi
                  </Text>
                  <Text className="text-sm text-gray-700">
                     Best value retailer
                  </Text>
               </View>
            </View>
         </View>
      </View>
   );
}
