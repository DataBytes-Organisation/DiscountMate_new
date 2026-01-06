import React from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export default function MultiStoreShoppingStrategySection() {
   const singleStore = {
      totalCost: 38.48,
      savings: 11.32,
      storesToVisit: 1,
      storeName: "Aldi",
   };

   const multiStore = {
      totalCost: 36.1,
      savings: 13.7,
      storesToVisit: 2,
   };

   const extraSavings = (singleStore.totalCost - multiStore.totalCost).toFixed(2);

   return (
      <View className="px-4 md:px-8 py-10 bg-[#F9FAFB]">
         <View className="w-full">
            {/* Header */}
            <View className="mb-8">
               <Text className="text-3xl font-bold text-gray-900 mb-2">
                  Multi-Store Shopping Strategy
               </Text>
               <Text className="text-base text-gray-600">
                  Maximize savings by splitting your basket across stores
               </Text>
            </View>

            {/* Main card container */}
            <View className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
               <View className="flex-row gap-6">
                  {/* Single store column */}
                  <View className="flex-1">
                     <View className="flex-row items-center gap-4 mb-6">
                        <View className="w-12 h-12 rounded-2xl bg-gray-100 items-center justify-center shadow-sm">
                           <FontAwesome6 name="store" size={18} color="#6B7280" />
                        </View>
                        <View>
                           <Text className="text-lg font-bold text-gray-900">
                              Single Store Shopping
                           </Text>
                           <Text className="text-sm text-gray-600">
                              Shop everything at {singleStore.storeName}
                           </Text>
                        </View>
                     </View>

                     <MetricRow
                        label="Total cost"
                        value={`$${singleStore.totalCost.toFixed(2)}`}
                        variant="neutral"
                     />
                     <MetricRow
                        label="Savings"
                        value={`$${singleStore.savings.toFixed(2)}`}
                        variant="neutralGreenValue"
                     />
                     <MetricRow
                        label="Stores to visit"
                        value={`${singleStore.storesToVisit}`}
                        variant="neutral"
                        noMargin
                     />
                  </View>

                  {/* Multi-store column */}
                  <View className="flex-1">
                     <View className="flex-row items-center gap-4 mb-6">
                        <View className="w-12 h-12 rounded-2xl bg-primary_green items-center justify-center shadow-sm">
                           <FontAwesome6 name="code-branch" size={18} color="#FFFFFF" />
                        </View>
                        <View>
                           <Text className="text-lg font-bold text-gray-900">
                              Multi-Store Shopping
                           </Text>
                           <Text className="text-sm text-gray-600">
                              Split basket for maximum savings
                           </Text>
                        </View>
                     </View>

                     <MetricRow
                        label="Total cost"
                        value={`$${multiStore.totalCost.toFixed(2)}`}
                        variant="highlight"
                     />
                     <MetricRow
                        label="Savings"
                        value={`$${multiStore.savings.toFixed(2)}`}
                        variant="highlight"
                     />
                     <MetricRow
                        label="Stores to visit"
                        value={`${multiStore.storesToVisit}`}
                        variant="highlightBold"
                        noMargin
                     />
                  </View>
               </View>

               {/* Orange banner */}
               <View className="mt-8 bg-amber-700 rounded-3xl px-8 py-7 flex-row items-center justify-between">
                  <View className="flex-1 pr-6">
                     <Text className="text-white text-lg font-bold mb-2">
                        Extra savings with multi-store: ${extraSavings}
                     </Text>
                     <Text className="text-white/90 text-sm">
                        Shop 4 items at Aldi, 4 items at Coles
                     </Text>
                  </View>

                  <Pressable className="bg-white rounded-2xl px-6 py-4 shadow-sm">
                     <Text className="text-gray-900 font-semibold">View Split Plan</Text>
                  </Pressable>
               </View>
            </View>
         </View>
      </View>
   );
}

function MetricRow({
   label,
   value,
   variant,
   noMargin,
}: {
   label: string;
   value: string;
   variant: "neutral" | "neutralGreenValue" | "highlight" | "highlightBold";
   noMargin?: boolean;
}) {
   const container =
      variant === "highlight" || variant === "highlightBold"
         ? "bg-emerald-50 border-emerald-100"
         : "bg-white border-gray-200";

   const valueColor =
      variant === "highlight" || variant === "highlightBold" || variant === "neutralGreenValue"
         ? "text-primary_green"
         : "text-gray-900";

   const valueSize = variant === "highlightBold" ? "text-xl" : "text-lg";

   return (
      <View
         className={[
            "rounded-2xl border px-5 py-5 flex-row items-center justify-between",
            container,
            noMargin ? "" : "mb-4",
         ].join(" ")}
      >
         <Text className="text-sm font-semibold text-gray-800">{label}</Text>
         <Text className={[valueSize, "font-bold", valueColor].join(" ")}>
            {value}
         </Text>
      </View>
   );
}
