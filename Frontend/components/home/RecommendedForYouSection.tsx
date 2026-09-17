import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import ProductCard, { Product } from "./ProductCard";
import { ApiProduct, mapApiProductToCard } from "./ProductGrid";
import { API_URL } from "@/constants/Api";

const RECOMMENDATION_LIMIT = 10;

type RecommendedProduct = ApiProduct & {
   discount_percent?: number | null;
};

interface RecommendationsResponse {
   success: boolean;
   recommendations?: RecommendedProduct[];
   count?: number;
   message?: string;
}

function mapRecommendationToCard(item: RecommendedProduct): Product {
   const card = mapApiProductToCard(item);
   if (item.discount_percent && item.discount_percent > 0) {
      card.badge = `${Math.round(item.discount_percent)}% off`;
      card.trendLabel = "On special";
      card.trendTone = "green";
   }
   return card;
}

export default function RecommendedForYouSection() {
   const [products, setProducts] = useState<Product[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      fetchRecommendations();
   }, []);

   const fetchRecommendations = async () => {
      try {
         setLoading(true);
         setError(null);

         const response = await fetch(`${API_URL}/ml/recommendations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ limit: RECOMMENDATION_LIMIT }),
         });
         const data: RecommendationsResponse = await response.json();

         if (response.ok && data.success && Array.isArray(data.recommendations)) {
            const mapped = data.recommendations
               .filter((item) => item && item._id)
               .slice(0, RECOMMENDATION_LIMIT)
               .map(mapRecommendationToCard);
            setProducts(mapped);
         } else {
            setError(data.message || "Failed to load recommendations");
         }
      } catch (err) {
         console.error("Error fetching recommendations:", err);
         setError("Unable to load recommendations right now.");
      } finally {
         setLoading(false);
      }
   };

   return (
      <View className="bg-white border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
            <View className="mb-10">
               <Text className="text-3xl font-bold text-[#111827] mb-2">
                  Recommended for You
               </Text>
               <Text className="text-gray-600">
                  Discounted picks from across the retailers
               </Text>
            </View>

            {loading && (
               <View className="flex items-center justify-center py-20">
                  <ActivityIndicator size="large" color="#10B981" />
                  <Text className="mt-4 text-gray-600">Finding recommendations...</Text>
               </View>
            )}

            {error && !loading && (
               <View className="flex items-center justify-center py-20">
                  <Text className="text-red-500 mb-4">{error}</Text>
                  <Pressable
                     onPress={fetchRecommendations}
                     className="px-6 py-3 rounded-xl bg-[#10B981]"
                  >
                     <Text className="text-white font-semibold">Retry</Text>
                  </Pressable>
               </View>
            )}

            {!loading && !error && products.length > 0 && (
               <View className="flex-row flex-wrap justify-center -mx-2">
                  {products.map((product) => (
                     <View key={product.id} className="w-full md:w-1/2 lg:w-1/3 px-2 mb-6">
                        <ProductCard product={product} />
                     </View>
                  ))}
               </View>
            )}

            {!loading && !error && products.length === 0 && (
               <View className="flex items-center justify-center py-20">
                  <Text className="text-gray-500">
                     No recommendations yet — check back soon.
                  </Text>
               </View>
            )}
         </View>
      </View>
   );
}
