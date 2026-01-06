import React from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

interface RetailerPrice {
   name: string;
   price: number;
   oldPrice: number;
   unitPrice: number;
   savings: number;
   savingsPercent: number;
   availability: string;
   isCheapest?: boolean;
   differenceFromCheapest?: number;
}

interface ProductPriceComparisonProps {
   productId?: string | string[];
}

export default function ProductPriceComparison({
   productId,
}: ProductPriceComparisonProps) {
   // Mock data matching the design
   const retailers: RetailerPrice[] = [
      {
         name: "Aldi",
         price: 3.5,
         oldPrice: 4.7,
         unitPrice: 1.75,
         savings: 1.2,
         savingsPercent: 25,
         availability: "In Stock",
         isCheapest: true,
      },
      {
         name: "Coles",
         price: 3.8,
         oldPrice: 5.0,
         unitPrice: 1.9,
         savings: 1.2,
         savingsPercent: 24,
         availability: "In Stock",
      },
      {
         name: "Woolworths",
         price: 4.2,
         oldPrice: 5.0,
         unitPrice: 2.1,
         savings: 0.8,
         savingsPercent: 16,
         availability: "In Stock",
      },
   ];

   const cheapest = Math.min(...retailers.map((r) => r.price));

   const decorated = retailers.map((r) => {
      const isCheapest = r.price === cheapest;
      const diff = isCheapest ? 0 : r.price - cheapest;
      return {
         ...r,
         isCheapest,
         differenceFromCheapest: diff > 0 ? diff : 0,
      };
   });

   return (
      <View className="bg-white rounded-2xl border border-gray-200 p-6 mt-6">
         {/* Header */}
         <View className="flex-row items-center justify-between mb-6">
            <Text className="text-xl font-bold text-gray-900">
               Multi-Retailer Price Comparison
            </Text>

            <Pressable className="flex-row items-center gap-2">
               <FontAwesome6
                  name="arrow-rotate-right"
                  size={14}
                  color="#10B981"
               />
               <Text className="text-sm font-semibold text-primary_green">
                  Refresh Prices
               </Text>
            </Pressable>
         </View>

         {/* Retailer cards */}
         <View className="gap-4">
            {decorated.map((retailer, index) => {
               if (retailer.isCheapest) {
                  // CHEAPEST CARD (big green one)
                  return (
                     <View
                        key={retailer.name}
                        className="rounded-2xl border-2 border-primary_green bg-primary_green/10 p-5"
                     >
                        {/* Top row: store chip + name + price */}
                        <View className="flex-row justify-between items-start mb-4">
                           <View className="gap-2">
                              <View className="px-3 py-1 rounded-lg border border-white/60 bg-white/80 self-start">
                                 <Text className="text-xs font-semibold text-gray-800 uppercase">
                                    {retailer.name}
                                 </Text>
                              </View>

                              <View className="flex-row items-center gap-2">
                                 <Text className="text-lg font-semibold text-gray-900">
                                    {retailer.name}
                                 </Text>
                                 <View className="px-2 py-1 rounded-full bg-primary_green">
                                    <Text className="text-[11px] font-semibold text-white">
                                       Best Price
                                    </Text>
                                 </View>
                              </View>
                           </View>

                           <View className="items-end">
                              <Text className="text-3xl font-bold text-gray-900">
                                 ${retailer.price.toFixed(2)}
                              </Text>
                              <Text className="text-sm text-gray-400 line-through mt-1">
                                 ${retailer.oldPrice.toFixed(2)}
                              </Text>
                           </View>
                        </View>

                        {/* Middle row: three tiles */}
                        <View className="flex-row gap-3 mb-4">
                           <View className="flex-1 bg-white rounded-xl px-4 py-3">
                              <Text className="text-xs text-gray-500 mb-1">
                                 Savings
                              </Text>
                              <Text className="text-sm font-semibold text-primary_green">
                                 ${retailer.savings.toFixed(2)} (
                                 {retailer.savingsPercent}%)
                              </Text>
                           </View>

                           <View className="flex-1 bg-white rounded-xl px-4 py-3">
                              <Text className="text-xs text-gray-500 mb-1">
                                 Unit Price
                              </Text>
                              <Text className="text-sm font-semibold text-gray-800">
                                 ${retailer.unitPrice.toFixed(2)}/L
                              </Text>
                           </View>

                           <View className="flex-1 bg-white rounded-xl px-4 py-3">
                              <Text className="text-xs text-gray-500 mb-1">
                                 Availability
                              </Text>
                              <Text className="text-sm font-semibold text-primary_green">
                                 {retailer.availability}
                              </Text>
                           </View>
                        </View>

                        {/* Bottom row: Add to List + View at Store */}
                        <View className="flex-row gap-3">
                           <Pressable className="flex-1 bg-primary_green rounded-xl py-3 items-center">
                              <Text className="text-white font-semibold">
                                 Add to List
                              </Text>
                           </Pressable>

                           <Pressable className="w-32 bg-white rounded-xl py-3 items-center border border-primary_green/30">
                              <Text className="text-sm font-semibold text-gray-800">
                                 View at Store
                              </Text>
                           </Pressable>
                        </View>
                     </View>
                  );
               }

               // NON-CHEAPEST CARDS
               return (
                  <View
                     key={retailer.name}
                     className="rounded-2xl border border-gray-200 bg-white p-5"
                  >
                     {/* Top row: store chip + name + price */}
                     <View className="flex-row justify-between items-start mb-4">
                        <View className="gap-2">
                           <View className="px-3 py-1 rounded-lg border border-gray-200 bg-gray-50 self-start">
                              <Text className="text-xs font-semibold text-gray-700 uppercase">
                                 {retailer.name}
                              </Text>
                           </View>

                           <Text className="text-lg font-semibold text-gray-900">
                              {retailer.name}
                           </Text>
                        </View>

                        <View className="items-end">
                           <Text className="text-3xl font-bold text-gray-900">
                              ${retailer.price.toFixed(2)}
                           </Text>
                           <Text className="text-sm text-gray-400 line-through mt-1">
                              ${retailer.oldPrice.toFixed(2)}
                           </Text>
                        </View>
                     </View>

                     {/* Middle row: three grey tiles */}
                     <View className="flex-row gap-3 mb-3">
                        <View className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                           <Text className="text-xs text-gray-500 mb-1">
                              Savings
                           </Text>
                           <Text className="text-sm font-semibold text-gray-800">
                              ${retailer.savings.toFixed(2)} (
                              {retailer.savingsPercent}%)
                           </Text>
                        </View>

                        <View className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                           <Text className="text-xs text-gray-500 mb-1">
                              Unit Price
                           </Text>
                           <Text className="text-sm font-semibold text-gray-800">
                              ${retailer.unitPrice.toFixed(2)}/L
                           </Text>
                        </View>

                        <View className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                           <Text className="text-xs text-gray-500 mb-1">
                              Availability
                           </Text>
                           <Text className="text-sm font-semibold text-gray-800">
                              {retailer.availability}
                           </Text>
                        </View>
                     </View>

                     {/* Difference line */}
                     {retailer.differenceFromCheapest &&
                        retailer.differenceFromCheapest > 0 && (
                           <View className="flex-row items-center gap-2 mb-3">
                              <FontAwesome6
                                 name="circle-exclamation"
                                 size={14}
                                 color="#FBBF24"
                              />
                              <Text className="text-sm text-gray-600">
                                 $
                                 {retailer.differenceFromCheapest.toFixed(2)} more
                                 than cheapest
                              </Text>
                           </View>
                        )}

                     {/* Bottom buttons */}
                     <View className="flex-row justify-end gap-3">
                        <Pressable className="px-5 py-3 rounded-xl bg-primary_green items-center">
                           <Text className="text-sm font-semibold text-white">
                              Add to List
                           </Text>
                        </Pressable>

                        <Pressable className="px-5 py-3 rounded-xl bg-white border border-gray-200 items-center">
                           <Text className="text-sm font-semibold text-gray-800">
                              View at Store
                           </Text>
                        </Pressable>
                     </View>
                  </View>
               );
            })}
         </View>
      </View>
   );
}
