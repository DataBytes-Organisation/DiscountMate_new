import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useShoppingLists } from "../../app/(tabs)/ShoppingListsContext";
import { accentDot } from "../my-lists/accentStyles";

type StoreKey = "coles" | "woolworths" | "iga";

const STORES: StoreKey[] = ["coles", "woolworths", "iga"];

export default function ComparisonToolsSection() {
   const { getActiveList, updateListItemsRetailers } = useShoppingLists();
   const [optimizationMessage, setOptimizationMessage] = useState<string | null>(null);
   const activeList = getActiveList();
   const optimizerStats = calculateOptimizerStats(activeList);

   useEffect(() => {
      if (!optimizationMessage) return;

      const timeout = setTimeout(() => {
         setOptimizationMessage(null);
      }, 3500);

      return () => clearTimeout(timeout);
   }, [optimizationMessage]);

   const openOptimizer = () => {
      if (!activeList) {
         setOptimizationMessage("Select or create a grocery list before optimizing.");
         return;
      }

      if (activeList) {
         const retailersByItemId = getOptimalRetailersByItemId(activeList);
         updateListItemsRetailers(activeList.id, retailersByItemId);
      }

      setOptimizationMessage(
         optimizerStats.isAlreadyOptimized
            ? `"${activeList.name}" is already optimized.`
            : `"${activeList.name}" has been optimized successfully.`
      );
   };

   return (
      <View className="bg-white border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
            {/* Header */}
            <View className="mb-10">
               <Text className="text-3xl font-bold text-[#111827] mb-2">
                  Comparison Tools
               </Text>
               <Text className="text-gray-600">
                  Advanced features to help you save more
               </Text>
            </View>

            {/* Two-column grid */}
            <View className="flex flex-col md:flex-row gap-6">
               {/* Unit Price Calculator card */}
               <View className="w-full md:w-1/2">
                  <View className="bg-gradient-to-br from-light to-white border border-gray-200 rounded-2xl p-10 hover:shadow-xl transition-all">
                     {/* Header row */}
                     <View className="flex-row items-start gap-5 mb-8">
                        <View className="w-16 h-16 bg-gradient-to-br from-primary_green to-secondary_green rounded-xl flex items-center justify-center shadow-lg">
                           <FontAwesome6 name="calculator" size={24} color="#FFFFFF" />
                        </View>
                        <View className="flex-1">
                           <Text className="text-xl text-[#111827] font-bold mb-2">
                              Unit Price Calculator
                           </Text>
                           <Text className="text-sm text-gray-600">
                              Compare products by weight, volume, or quantity to find the best value
                           </Text>
                        </View>
                     </View>

                     {/* Example rows */}
                     <View className="space-y-4">
                        <View className="flex-row items-center justify-between p-5 bg-white border border-gray-200 rounded-xl">
                           <View>
                              <Text className="text-sm text-[#111827] font-semibold">
                                 500g @ $7.50
                              </Text>
                              <Text className="text-xs text-gray-500">
                                 $15.00 per kg
                              </Text>
                           </View>
                           <Text className="text-lg text-[#111827] font-bold">
                              $15.00/kg
                           </Text>
                        </View>

                        <View className="flex-row items-center justify-between p-5 bg-gradient-to-r from-primary_green/10 to-secondary_green/10 border border-primary_green/30 rounded-xl">
                           <View>
                              <Text className="text-sm text-[#111827] font-semibold">
                                 1kg @ $12.00
                              </Text>
                              <Text className="text-xs text-primary_green font-semibold">
                                 Best value - Save $3.00 per kg
                              </Text>
                           </View>
                           <Text className="text-lg text-primary_green font-bold">
                              $12.00/kg
                           </Text>
                        </View>
                     </View>

                     {/* CTA */}
                     <Pressable className="w-full mt-8 py-4 bg-gradient-to-r from-primary_green to-secondary_green rounded-xl items-center justify-center hover:shadow-lg transition-all">
                        <Text className="text-white font-semibold">
                           Open Calculator
                        </Text>
                     </Pressable>
                  </View>
               </View>

               {/* Grocery List Optimizer card */}
               <View className="w-full md:w-1/2">
                  <View className="bg-gradient-to-br from-light to-white border border-gray-200 rounded-2xl p-10 hover:shadow-xl transition-all">
                     {/* Header row */}
                     <View className="flex-row items-start gap-5 mb-8">
                        <View className="w-16 h-16 bg-gradient-to-br from-primary_green to-secondary_green rounded-xl flex items-center justify-center shadow-lg">
                           <FontAwesome6 name="basket-shopping" size={24} color="#FFFFFF" />
                        </View>
                        <View className="flex-1">
                           <Text className="text-xl text-[#111827] font-bold mb-2">
                              Grocery List Optimizer
                           </Text>
                           <Text className="text-sm text-gray-600">
                              Split your shopping across stores to maximize savings
                           </Text>
                        </View>
                     </View>

                     <View className="space-y-4">
                        {/* Current grocery list */}
                        <View className="p-5 bg-white border border-gray-200 rounded-xl">
                           <View className="flex-row items-center justify-between mb-3">
                              <View className="flex-1 pr-3">
                                 <Text className="text-sm text-[#111827] font-semibold">
                                    Current grocery list
                                 </Text>
                                 <View className="flex-row items-center gap-2 mt-0.5">
                                    {activeList ? (
                                       <View className={`w-2 h-2 rounded-full ${accentDot[activeList.accent]}`} />
                                    ) : null}
                                    <Text className="text-xs text-gray-500" numberOfLines={1}>
                                       {activeList?.name ?? "Select or create a list"}
                                    </Text>
                                 </View>
                              </View>
                              <Text className="text-sm text-gray-600 font-semibold">
                                 ${optimizerStats.currentTotal.toFixed(2)}
                              </Text>
                           </View>
                           <View className="w-full bg-gray-200 rounded-full h-3">
                              <View
                                 className="bg-gray-400 h-3 rounded-full"
                                 style={{ width: `${optimizerStats.currentBarPercent}%` }}
                              />
                           </View>
                        </View>

                        {/* Optimized split */}
                        <View className="p-5 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl">
                           <View className="flex-row items-center justify-between mb-3 gap-3">
                              <View className="flex-row items-center gap-2 flex-1 min-w-0">
                                 <Text className="text-sm text-[#111827] font-semibold">
                                    Optimized split
                                 </Text>
                                 {optimizerStats.isAlreadyOptimized ? (
                                    <Text className="text-xs text-amber-700 font-semibold" numberOfLines={1}>
                                       · Current list is already optimized
                                    </Text>
                                 ) : null}
                              </View>
                              <Text className="text-sm text-amber-700 font-bold">
                                 ${optimizerStats.optimizedTotal.toFixed(2)}
                              </Text>
                           </View>

                           <View className="w-full bg-gray-200 rounded-full h-3 mb-3">
                              <View
                                 className="bg-gradient-to-r from-amber-400 to-amber-600 h-3 rounded-full"
                                 style={{ width: `${optimizerStats.optimizedBarPercent}%` }}
                              />
                           </View>

                           <Text className="text-xs text-amber-700 font-semibold">
                              {optimizerStats.isAlreadyOptimized
                                 ? `Already at the best split across ${optimizerStats.storesToVisit} ${
                                      optimizerStats.storesToVisit === 1 ? "store" : "stores"
                                   }`
                                 : `Save ${optimizerStats.savings.toFixed(2)} by shopping at ${
                                      optimizerStats.storesToVisit
                                   } ${optimizerStats.storesToVisit === 1 ? "store" : "stores"}`}
                           </Text>
                        </View>
                     </View>

                     {optimizationMessage ? (
                        <View className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                           <Text className="text-sm font-semibold text-emerald-700">
                              {optimizationMessage}
                           </Text>
                        </View>
                     ) : null}

                     {/* CTA */}
                     <Pressable
                        onPress={openOptimizer}
                        className="w-full mt-8 py-4 bg-gradient-to-r from-primary_green to-secondary_green rounded-xl items-center justify-center hover:shadow-lg transition-all"
                     >
                        <Text className="text-white font-semibold">
                           Optimize My Grocery List
                        </Text>
                     </Pressable>
                  </View>
               </View>
            </View>
         </View>
      </View>
   );
}

function calculateOptimizerStats(list: ReturnType<typeof useShoppingLists>["lists"][number] | null) {
   if (!list || list.items.length === 0) {
      return {
         currentTotal: 0,
         optimizedTotal: 0,
         savings: 0,
         storesToVisit: 0,
         currentBarPercent: 0,
         optimizedBarPercent: 0,
         isAlreadyOptimized: false,
      };
   }

   const currentTotal = list.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
   );

   const plan = list.items.flatMap((item) => {
      const options = STORES
         .map((store) => ({ store, price: item.retailerPrices?.[store] }))
         .filter(
            (option): option is { store: StoreKey; price: number } =>
               typeof option.price === "number" && option.price > 0
         )
         .sort((a, b) => a.price - b.price);

      const best = options[0];
      if (!best) return [];

      return [{
         store: best.store,
         lineTotal: best.price * item.quantity,
      }];
   });

   const optimizedTotal = plan.reduce((sum, item) => sum + item.lineTotal, 0);
   const storesToVisit = new Set(plan.map((item) => item.store)).size;
   const highestAvailableTotal = list.items.reduce((sum, item) => {
      const prices = STORES
         .map((store) => item.retailerPrices?.[store])
         .filter((price): price is number => typeof price === "number" && price > 0);

      if (prices.length === 0) return sum + item.price * item.quantity;
      return sum + Math.max(...prices) * item.quantity;
   }, 0);
   const scaleTotal = Math.max(currentTotal, optimizedTotal, highestAvailableTotal, 1);
   const isAlreadyOptimized = Math.abs(currentTotal - optimizedTotal) < 0.005;

   return {
      currentTotal,
      optimizedTotal,
      savings: Math.max(0, highestAvailableTotal - optimizedTotal),
      storesToVisit,
      currentBarPercent: Math.max(8, Math.min(100, (currentTotal / scaleTotal) * 100)),
      optimizedBarPercent: Math.max(8, Math.min(100, (optimizedTotal / scaleTotal) * 100)),
      isAlreadyOptimized,
   };
}

function getOptimalRetailersByItemId(
   list: ReturnType<typeof useShoppingLists>["lists"][number]
) {
   return list.items.reduce<Record<string, StoreKey>>((acc, item) => {
      const options = STORES
         .map((store) => ({ store, price: item.retailerPrices?.[store] }))
         .filter(
            (option): option is { store: StoreKey; price: number } =>
               typeof option.price === "number" && option.price > 0
         )
         .sort((a, b) => a.price - b.price);

      const best = options[0];
      if (best) {
         acc[item.id] = best.store;
      }

      return acc;
   }, {});
}
