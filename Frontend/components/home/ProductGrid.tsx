import React from "react";
import { View, Text, Pressable } from "react-native";
import ProductCard from "./ProductCard";

const PRODUCTS = [
   {
      name: "Milk Full Cream 2L",
      subtitle: "Fresh dairy milk",
      badge: "Save $1.20",
      badgeTone: "accent",
      trendLabel: "Trending down",
      trendTone: "green",
   },
   {
      name: "White Bread 700g",
      subtitle: "Soft white sandwich bread",
      badge: "Save $0.85",
      badgeTone: "accent",
      trendLabel: "Price rising",
      trendTone: "red",
   },
   {
      name: "Bananas 1kg",
      subtitle: "Fresh Australian bananas",
      badge: "Save $1.50",
      badgeTone: "accent",
      trendLabel: "Stable",
      trendTone: "neutral",
   },
   {
      name: "Pasta Penne 500g",
      subtitle: "Italian durum wheat pasta",
      badge: "Save $0.50",
      badgeTone: "accent",
      trendLabel: "Trending down",
      trendTone: "green",
   },
   {
      name: "Cheddar Cheese Block 500g",
      subtitle: "Tasty mature cheddar",
      badge: "Save $2.30",
      badgeTone: "accent",
      trendLabel: "Hot deal",
      trendTone: "orange",
   },
   {
      name: "Orange Juice 2L",
      subtitle: "100% pure squeezed orange juice",
      badge: "Save $1.80",
      badgeTone: "accent",
      trendLabel: "Trending down",
      trendTone: "green",
   },
   {
      name: "Toilet Paper 24 Pack",
      subtitle: "Soft 3-ply quilted tissue",
      badge: "Save $3.00",
      badgeTone: "accent",
      trendLabel: "Bulk deal",
      trendTone: "orange",
   },
   {
      name: "Coffee Beans 1kg",
      subtitle: "Premium arabica coffee beans",
      badge: "Save $4.50",
      badgeTone: "accent",
      trendLabel: "Trending down",
      trendTone: "green",
   },
   {
      name: "Greek Yogurt 1kg",
      subtitle: "Natural full fat yogurt",
      badge: "Save $1.90",
      badgeTone: "accent",
      trendLabel: "Trending down",
      trendTone: "green",
   },
];

export default function ProductGrid() {
   return (
      <View>
         {/* Controls */}
         <View className="flex-row justify-between items-center mb-6">
            <View className="flex-row items-center space-x-4">
               <Pressable className="flex-row items-center px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white">
                  <Text className="mr-2 text-sm text-gray-700">⚙️</Text>
                  <Text className="text-sm font-medium text-gray-700">Add Filters</Text>
               </Pressable>
               <Text className="text-sm text-gray-600">
                  Showing <Text className="text-[#10B981] font-bold">247</Text> products
               </Text>
            </View>
            <Pressable className="px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white">
               <Text className="text-sm font-medium text-gray-700">
                  Sort by: Best Savings
               </Text>
            </Pressable>
         </View>

         {/* Grid */}
         <View className="flex-row flex-wrap -mx-3">
            {PRODUCTS.map((p) => (
               <View key={p.name} className="w-full md:w-1/2 lg:w-1/3 px-3 mb-6">
                  <ProductCard {...p} />
               </View>
            ))}
         </View>

         {/* Pagination */}
         <View className="mt-8 flex-row justify-center items-center space-x-2">
            <Pressable className="px-4 py-2 rounded-xl border-2 border-gray-200 opacity-40">
               <Text className="text-sm text-gray-400">{"<"}</Text>
            </Pressable>
            <Pressable className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669]">
               <Text className="text-sm font-semibold text-white">1</Text>
            </Pressable>
            {[2, 3, 4].map((n) => (
               <Pressable
                  key={n}
                  className="px-4 py-2 rounded-xl border-2 border-gray-200 bg-white"
               >
                  <Text className="text-sm text-gray-700">{n}</Text>
               </Pressable>
            ))}
            <Text className="px-2 text-gray-500">...</Text>
            <Pressable className="px-4 py-2 rounded-xl border-2 border-gray-200 bg-white">
               <Text className="text-sm text-gray-700">12</Text>
            </Pressable>
            <Pressable className="px-4 py-2 rounded-xl border-2 border-gray-200 bg-white">
               <Text className="text-sm text-gray-700">{">"}</Text>
            </Pressable>
         </View>
      </View>
   );
}
