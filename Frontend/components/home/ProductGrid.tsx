// Frontend/components/product/ProductGrid.tsx
import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import ProductCard, { Product } from "./ProductCard";
import ProductFilterSection from "../common/ProductFilterSection";

const PRODUCTS: Product[] = [
   {
      name: "Milk Full Cream 2L",
      subtitle: "Fresh dairy milk",
      icon: "wine-glass",
      badge: "Save $1.20",
      trendLabel: "Trending down",
      trendTone: "green",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$3.80",
            originalPrice: "$5.00",
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$4.20",
            originalPrice: "$5.00",
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$3.50",
            originalPrice: "$4.70",
            isCheapest: true,
         },
      ],
   },
   {
      name: "White Bread 700g",
      subtitle: "Soft white sandwich bread",
      icon: "bread-slice",
      badge: "Save $0.85",
      trendLabel: "Price rising",
      trendTone: "red",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$2.50",
            originalPrice: "$3.35",
            isCheapest: true,
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$2.80",
            originalPrice: "$3.20",
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$2.90",
            originalPrice: "-",
         },
      ],
   },
   {
      name: "Bananas 1kg",
      subtitle: "Fresh Australian bananas",
      icon: "apple-whole",
      badge: "Save $1.50",
      trendLabel: "Stable",
      trendTone: "neutral",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$3.20",
            originalPrice: "$4.00",
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$2.90",
            originalPrice: "$4.40",
            isCheapest: true,
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$3.10",
            originalPrice: "$3.90",
         },
      ],
   },
   {
      name: "Pasta Penne 500g",
      subtitle: "Italian durum wheat pasta",
      icon: "wheat-awn",
      badge: "Save $0.50",
      trendLabel: "Trending down",
      trendTone: "green",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$2.00",
            originalPrice: "$2.50",
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$2.10",
            originalPrice: "$2.50",
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$1.79",
            originalPrice: "$2.29",
            isCheapest: true,
         },
      ],
   },
   {
      name: "Cheddar Cheese Block 500g",
      subtitle: "Tasty mature cheddar",
      icon: "cheese",
      badge: "Save $2.30",
      trendLabel: "Hot deal",
      trendTone: "orange",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$7.50",
            originalPrice: "$9.00",
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$6.80",
            originalPrice: "$9.10",
            isCheapest: true,
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$7.20",
            originalPrice: "$8.50",
         },
      ],
   },
   {
      name: "Orange Juice 2L",
      subtitle: "100% pure squeezed orange juice",
      icon: "glass-water",
      badge: "Save $1.80",
      trendLabel: "Trending down",
      trendTone: "green",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$5.20",
            originalPrice: "$7.00",
            isCheapest: true,
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$5.50",
            originalPrice: "$6.80",
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$5.90",
            originalPrice: "$6.50",
         },
      ],
   },
   {
      name: "Toilet Paper 24 Pack",
      subtitle: "Soft 3-ply quilted tissue",
      icon: "toilet-paper",
      badge: "Save $3.00",
      trendLabel: "Bulk deal",
      trendTone: "orange",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$16.00",
            originalPrice: "$19.00",
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$15.80",
            originalPrice: "$18.50",
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$14.99",
            originalPrice: "$17.99",
            isCheapest: true,
         },
      ],
   },
   {
      name: "Coffee Beans 1kg",
      subtitle: "Premium arabica coffee beans",
      icon: "mug-hot",
      badge: "Save $4.50",
      trendLabel: "Trending down",
      trendTone: "green",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$22.00",
            originalPrice: "$26.50",
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$21.50",
            originalPrice: "$26.00",
            isCheapest: true,
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$23.90",
            originalPrice: "$25.50",
         },
      ],
   },
   {
      name: "Greek Yogurt 1kg",
      subtitle: "Natural full fat yogurt",
      icon: "bowl-food",
      badge: "Save $1.90",
      trendLabel: "Trending down",
      trendTone: "green",
      retailers: [
         {
            storeKey: "coles",
            name: "Coles",
            price: "$6.50",
            originalPrice: "$8.00",
         },
         {
            storeKey: "woolworths",
            name: "Woolworths",
            price: "$6.80",
            originalPrice: "$8.20",
         },
         {
            storeKey: "aldi",
            name: "Aldi",
            price: "$5.99",
            originalPrice: "$7.89",
            isCheapest: true,
         },
      ],
   },
];

const ProductGrid: React.FC = () => {
   const productCount = PRODUCTS.length; // You can replace this with actual count from your data

   return (
      <ScrollView
         className="flex-1 px-4 md:px-8 pt-4 pb-10"
         contentContainerStyle={{ paddingBottom: 40 }}
      >
         {/* Product Filter Section */}
         <ProductFilterSection productCount={productCount} />

         {/* Product grid */}
         <View className="flex-row flex-wrap -mx-2">
            {PRODUCTS.map((product, index) => (
               <View
                  key={`${product.name}-${index}`}
                  className="w-full md:w-1/2 lg:w-1/3 px-2 mb-6"
               >
                  <ProductCard product={product} />
               </View>
            ))}
         </View>

         {/* Pagination */}
         <View className="mt-8 flex-row items-center justify-center space-x-2">
            <Pressable className="px-4 py-2 rounded-xl border-2 border-gray-200">
               <Text className="text-sm text-gray-400">{"<"}</Text>
            </Pressable>

            <Pressable className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0DAD79] to-[#13C296]">
               <Text className="text-sm font-semibold text-white">1</Text>
            </Pressable>

            <Pressable className="px-4 py-2 rounded-xl border-2 border-gray-200">
               <Text className="text-sm text-gray-700">2</Text>
            </Pressable>
            <Pressable className="px-4 py-2 rounded-xl border-2 border-gray-200">
               <Text className="text-sm text-gray-700">3</Text>
            </Pressable>
            <Pressable className="px-4 py-2 rounded-xl border-2 border-gray-200">
               <Text className="text-sm text-gray-700">4</Text>
            </Pressable>

            <Text className="px-2 text-gray-500">...</Text>

            <Pressable className="px-4 py-2 rounded-xl border-2 border-gray-200">
               <Text className="text-sm text-gray-700">12</Text>
            </Pressable>

            <Pressable className="px-4 py-2 rounded-xl border-2 border-gray-200">
               <Text className="text-sm text-gray-700">{">"}</Text>
            </Pressable>
         </View>
      </ScrollView>
   );
};

export default ProductGrid;
