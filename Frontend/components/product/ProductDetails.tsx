import React from "react";
import { View, Text } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

interface ProductDetailsProps {
   productId?: string | string[];
}

export default function ProductDetails({ productId }: ProductDetailsProps) {
   // Mock data
   const product = {
      description:
         "Fresh full cream milk sourced from local Australian dairy farms. Rich and creamy texture perfect for drinking, cooking, and baking. Contains essential nutrients including calcium, protein, and vitamins A and D. Pasteurised and homogenised for quality and safety. No artificial additives or preservatives.",
      nutritionalInfo: {
         energy: "274kJ",
         protein: "3.3g",
         fat: "3.8g",
         calcium: "120mg",
      },
      specifications: {
         brand: "Dairy Valley",
         size: "2 Liters",
         fatContent: "Full Cream (3.8%)",
         origin: "Australian Farms",
         storage: "Refrigerate below 4°C",
         shelfLife: "7–10 days after opening",
         barcode: "9312345678901",
      },
      allergens: "Milk and dairy products",
      mayContain:
         "May contain traces of other allergens due to manufacturing processes",
   };

   return (
      <View className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
         {/* Title */}
         <Text className="text-xl font-bold text-gray-900 mb-4">
            Product Details
         </Text>

         {/* Description */}
         <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-900 mb-2">
               Description
            </Text>
            <Text className="text-sm text-gray-700 leading-6">
               {product.description}
            </Text>
         </View>

         {/* Divider */}
         <View className="h-px bg-gray-200 my-4" />

         {/* Nutritional Information */}
         <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-900 mb-3">
               Nutritional Information
            </Text>

            <View className="flex-row flex-wrap gap-3">
               {/* Energy */}
               <View className="flex-1 min-w-[140px] bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                  <Text className="text-xs text-gray-500 mb-1">Energy</Text>
                  <Text className="text-lg font-semibold text-gray-900">
                     {product.nutritionalInfo.energy}
                  </Text>
                  <Text className="text-[11px] text-gray-500 mt-1">
                     per 100ml
                  </Text>
               </View>

               {/* Protein */}
               <View className="flex-1 min-w-[140px] bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                  <Text className="text-xs text-gray-500 mb-1">Protein</Text>
                  <Text className="text-lg font-semibold text-gray-900">
                     {product.nutritionalInfo.protein}
                  </Text>
                  <Text className="text-[11px] text-gray-500 mt-1">
                     per 100ml
                  </Text>
               </View>

               {/* Fat */}
               <View className="flex-1 min-w-[140px] bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                  <Text className="text-xs text-gray-500 mb-1">Fat</Text>
                  <Text className="text-lg font-semibold text-gray-900">
                     {product.nutritionalInfo.fat}
                  </Text>
                  <Text className="text-[11px] text-gray-500 mt-1">
                     per 100ml
                  </Text>
               </View>

               {/* Calcium */}
               <View className="flex-1 min-w-[140px] bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                  <Text className="text-xs text-gray-500 mb-1">Calcium</Text>
                  <Text className="text-lg font-semibold text-gray-900">
                     {product.nutritionalInfo.calcium}
                  </Text>
                  <Text className="text-[11px] text-gray-500 mt-1">
                     per 100ml
                  </Text>
               </View>
            </View>
         </View>

         {/* Divider */}
         <View className="h-px bg-gray-200 my-4" />

         {/* Product Specifications */}
         <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-900 mb-3">
               Product Specifications
            </Text>

            <View className="border-t border-gray-100">
               {[
                  ["Brand", product.specifications.brand],
                  ["Size", product.specifications.size],
                  ["Fat Content", product.specifications.fatContent],
                  ["Origin", product.specifications.origin],
                  ["Storage", product.specifications.storage],
                  ["Shelf Life", product.specifications.shelfLife],
                  ["Barcode", product.specifications.barcode],
               ].map(([label, value], index, arr) => (
                  <View
                     key={label}
                     className={[
                        "flex-row justify-between items-center py-3",
                        index < arr.length - 1 ? "border-b border-gray-100" : "",
                     ].join(" ")}
                  >
                     <Text className="text-sm text-gray-600">{label}</Text>
                     <Text className="text-sm text-gray-900">{value}</Text>
                  </View>
               ))}
            </View>
         </View>

         {/* Divider */}
         <View className="h-px bg-gray-200 my-4" />

         {/* Allergen Information */}
         <View>
            <Text className="text-sm font-semibold text-gray-900 mb-2">
               Allergen Information
            </Text>

            <View className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3">
               <View className="flex-row gap-3">
                  <View className="pt-1">
                     <FontAwesome6
                        name="triangle-exclamation"
                        size={18}
                        color="#D97706"
                     />
                  </View>
                  <View className="flex-1">
                     <Text className="text-sm text-gray-900 mb-1">
                        <Text className="font-semibold">Contains:</Text>{" "}
                        {product.allergens}
                     </Text>
                     <Text className="text-xs text-gray-700">
                        {product.mayContain}
                     </Text>
                  </View>
               </View>
            </View>
         </View>
      </View>
   );
}
