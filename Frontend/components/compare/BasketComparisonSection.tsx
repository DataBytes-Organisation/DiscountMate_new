import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

type StoreKey = "aldi" | "coles" | "woolworths";

type BasketItem = {
   id: string;
   name: string;
   subtitle: string;
   qty: number;
   icon: string;
   prices: Record<StoreKey, number>; // per-item total for that qty (like the table)
};

export default function BasketComparisonSection() {
   const basketItems: BasketItem[] = [
      {
         id: "1",
         name: "Milk Full Cream 2L",
         subtitle: "Fresh dairy milk",
         qty: 2,
         icon: "bottle-water",
         prices: { coles: 7.6, woolworths: 8.4, aldi: 7.0 },
      },
      {
         id: "2",
         name: "White Bread 700g",
         subtitle: "Soft white sandwich",
         qty: 1,
         icon: "bread-slice",
         prices: { coles: 2.5, woolworths: 2.8, aldi: 2.9 },
      },
      {
         id: "3",
         name: "Bananas 1kg",
         subtitle: "Fresh Australian",
         qty: 1,
         icon: "lemon",
         prices: { coles: 3.2, woolworths: 2.9, aldi: 3.1 },
      },
      {
         id: "4",
         name: "Cheddar Cheese Block 500g",
         subtitle: "Tasty mature",
         qty: 1,
         icon: "cheese",
         prices: { coles: 7.5, woolworths: 6.8, aldi: 7.2 },
      },
      {
         id: "5",
         name: "Pasta Penne 500g",
         subtitle: "Italian durum wheat",
         qty: 2,
         icon: "bowl-food",
         prices: { coles: 4.0, woolworths: 4.2, aldi: 3.58 },
      },
      {
         id: "6",
         name: "Orange Juice 2L",
         subtitle: "100% pure squeezed",
         qty: 1,
         icon: "glass-water",
         prices: { coles: 5.2, woolworths: 5.5, aldi: 5.9 },
      },
   ];

   const bestStoreForItem = (item: BasketItem) => {
      const entries = Object.entries(item.prices) as [StoreKey, number][];
      entries.sort((a, b) => a[1] - b[1]);
      return entries[0][0];
   };

   const storeLabel = (k: StoreKey) =>
      k === "aldi" ? "Aldi" : k === "coles" ? "Coles" : "Woolworths";

   const storeTotals = {
      aldi: 38.48,
      coles: 40.0,
      woolworths: 41.4,
   };

   const cheapestStore: StoreKey = "aldi";
   const cheapestTotal = storeTotals[cheapestStore];
   const deltas = {
      coles: storeTotals.coles - cheapestTotal,
      woolworths: storeTotals.woolworths - cheapestTotal,
   };

   const wins = {
      aldi: 3,
      coles: 2,
      woolworths: 2,
   };

   // For the progress bars in store totals card
   const winPercent = (store: StoreKey) => {
      const totalItems = basketItems.length;
      return Math.round((wins[store] / totalItems) * 100);
   };

   // Savings summary (mock values)
   const originalTotal = 49.8;
   const optimizedTotal = 38.48;
   const totalSavings = originalTotal - optimizedTotal;
   const savingsFromDiscounts = 6.8;
   const savingsFromBestPrices = 4.52;

   return (
      <View className="px-4 md:px-8 py-10 bg-[#F9FAFB]">
         <View className="w-full">
            {/* Header */}
            <View className="flex-row items-start justify-between mb-8">
               <View>
                  <Text className="text-3xl font-bold text-gray-900 mb-2">
                     Basket Comparison
                  </Text>
                  <Text className="text-base text-gray-600">
                     Compare your basket total across all retailers
                  </Text>
               </View>

               <Pressable className="bg-primary_green rounded-2xl px-5 py-3 flex-row items-center gap-2 shadow-sm">
                  <FontAwesome6 name="arrows-rotate" size={14} color="#FFFFFF" />
                  <Text className="text-white font-semibold">Optimize Basket</Text>
               </Pressable>
            </View>

            {/* Top grid: Basket + Store totals */}
            <View className="flex-row gap-6 mb-8">
               {/* Your Basket */}
               <View className="flex-[2] bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
                  <View className="flex-row items-center justify-between mb-4">
                     <Text className="text-lg font-bold text-gray-900">
                        Your Basket{" "}
                        <Text className="text-primary_green font-bold">
                           ({basketItems.length} items)
                        </Text>
                     </Text>

                     <Pressable className="flex-row items-center gap-2">
                        <FontAwesome6 name="pen" size={12} color="#10B981" />
                        <Text className="text-primary_green font-semibold text-sm">
                           Edit
                        </Text>
                     </Pressable>
                  </View>

                  <View className="rounded-2xl border border-gray-200 overflow-hidden">
                     {basketItems.map((item, idx) => (
                        <View
                           key={item.id}
                           className={[
                              "flex-row items-center px-4 py-4 bg-white",
                              idx < basketItems.length - 1 ? "border-b border-gray-100" : "",
                           ].join(" ")}
                        >
                           <View className="w-12 h-12 rounded-xl bg-gray-100 items-center justify-center mr-4">
                              <FontAwesome6 name={item.icon as any} size={16} color="#9CA3AF" />
                           </View>

                           <View className="flex-1">
                              <Text className="font-semibold text-gray-900">{item.name}</Text>
                              <Text className="text-xs text-gray-500 mt-1">{item.subtitle}</Text>
                           </View>

                           <View className="flex-row items-center gap-3">
                              <Text className="text-sm text-gray-700 font-semibold">
                                 Qty: {item.qty}
                              </Text>
                              <FontAwesome6 name="trash" size={14} color="#9CA3AF" />
                           </View>
                        </View>
                     ))}
                  </View>
               </View>

               {/* Store Totals */}
               <View className="flex-1 bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
                  <Text className="text-lg font-bold text-gray-900 mb-4">
                     Store Totals
                  </Text>

                  {/* Aldi (highlight cheapest) */}
                  <StoreTotalCard
                     store="Aldi"
                     total={storeTotals.aldi}
                     savings={11.32}
                     isCheapest
                     winsText={`Wins on ${wins.aldi} items`}
                     winPercent={winPercent("aldi")}
                  />

                  {/* Coles */}
                  <StoreTotalCard
                     store="Coles"
                     total={storeTotals.coles}
                     delta={`+${deltas.coles.toFixed(2)}`}
                     winsText={`Wins on ${wins.coles} items`}
                     winPercent={winPercent("coles")}
                  />

                  {/* Woolworths */}
                  <StoreTotalCard
                     store="Woolworths"
                     total={storeTotals.woolworths}
                     delta={`+${deltas.woolworths.toFixed(2)}`}
                     winsText={`Wins on ${wins.woolworths} items`}
                     winPercent={winPercent("woolworths")}
                  />
               </View>
            </View>

            {/* Bottom grid: Item breakdown + Savings summary */}
            <View className="flex-row gap-6">
               {/* Item-by-Item Breakdown */}
               <View className="flex-[2] bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
                  <View className="px-6 py-5 border-b border-gray-200 bg-gray-50">
                     <Text className="text-lg font-bold text-gray-900">
                        Item-by-Item Breakdown
                     </Text>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                     <View className="min-w-full">
                        {/* Table header */}
                        <View className="flex-row bg-gray-50 border-b border-gray-200">
                           <TableHeader title="Item" width={290} />
                           <TableHeader title="Qty" width={90} />
                           <TableHeader title="Coles" width={140} />
                           <TableHeader title="Woolworths" width={160} />
                           <TableHeader title="Aldi" width={140} isLast />
                        </View>

                        {/* Rows */}
                        {basketItems.map((item, idx) => {
                           const best = bestStoreForItem(item);

                           return (
                              <View
                                 key={item.id}
                                 className={[
                                    "flex-row",
                                    idx < basketItems.length - 1 ? "border-b border-gray-100" : "",
                                 ].join(" ")}
                              >
                                 <View className="w-[290px] px-6 py-4">
                                    <Text className="text-sm font-semibold text-gray-900">
                                       {item.name}
                                    </Text>
                                 </View>

                                 <View className="w-[90px] px-4 py-4">
                                    <Text className="text-sm text-gray-900 font-semibold">
                                       {item.qty}
                                    </Text>
                                 </View>

                                 <PriceCell value={item.prices.coles} isBest={best === "coles"} width={140} />
                                 <PriceCell value={item.prices.woolworths} isBest={best === "woolworths"} width={160} />
                                 <PriceCell value={item.prices.aldi} isBest={best === "aldi"} width={140} />
                              </View>
                           );
                        })}
                     </View>
                  </ScrollView>
               </View>

               {/* Savings Summary */}
               <View className="flex-1 bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
                  <Text className="text-lg font-bold text-gray-900 mb-4">
                     Savings Summary
                  </Text>

                  <SummaryRow label="Original total" value={`$${originalTotal.toFixed(2)}`} />
                  <SummaryRow label="Optimized total" value={`$${optimizedTotal.toFixed(2)}`} />

                  <View className="h-px bg-gray-200 my-4" />

                  <View className="flex-row items-center justify-between mb-4">
                     <Text className="text-sm font-semibold text-gray-800">Total savings</Text>
                     <Text className="text-2xl font-bold text-primary_green">
                        ${totalSavings.toFixed(2)}
                     </Text>
                  </View>

                  <View className="border-t border-gray-100 pt-4">
                     <Text className="text-xs font-semibold text-gray-600 mb-3">
                        Savings breakdown:
                     </Text>

                     <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-xs text-gray-600">• From discounts</Text>
                        <Text className="text-xs font-semibold text-gray-800">
                           ${savingsFromDiscounts.toFixed(2)}
                        </Text>
                     </View>

                     <View className="flex-row items-center justify-between">
                        <Text className="text-xs text-gray-600">• From best prices</Text>
                        <Text className="text-xs font-semibold text-gray-800">
                           ${savingsFromBestPrices.toFixed(2)}
                        </Text>
                     </View>
                  </View>

                  <Pressable className="mt-6 bg-primary_green rounded-2xl py-4 items-center shadow-sm">
                     <Text className="text-white font-semibold">Shop at Aldi</Text>
                  </Pressable>
               </View>
            </View>
         </View>
      </View>
   );
}

/* ---------- Components ---------- */

function StoreTotalCard({
   store,
   total,
   savings,
   delta,
   isCheapest,
   winsText,
   winPercent,
}: {
   store: string;
   total: number;
   savings?: number;
   delta?: string;
   isCheapest?: boolean;
   winsText: string;
   winPercent: number;
}) {
   return (
      <View
         className={[
            "rounded-2xl border border-gray-200 p-5 mb-4",
            isCheapest ? "bg-emerald-50 border-emerald-100" : "bg-white",
         ].join(" ")}
      >
         <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
               {isCheapest ? (
                  <FontAwesome6 name="trophy" size={14} color="#D97706" />
               ) : null}
               <Text className="font-semibold text-gray-900">{store}</Text>
            </View>

            {isCheapest ? (
               <View className="px-3 py-1 rounded-full bg-amber-600">
                  <Text className="text-white text-xs font-semibold">Cheapest</Text>
               </View>
            ) : delta ? (
               <Text className="text-xs font-semibold text-red-500">{delta}</Text>
            ) : null}
         </View>

         <Text className="text-3xl font-bold text-gray-900 mb-1">
            ${total.toFixed(2)}
         </Text>

         {typeof savings === "number" ? (
            <Text className="text-sm font-semibold text-primary_green mb-4">
               You save ${savings.toFixed(2)}
            </Text>
         ) : (
            <Text className="text-sm text-gray-600 mb-4"> </Text>
         )}

         <View className="h-px bg-gray-100 mb-3" />

         <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs text-gray-600">{winsText}</Text>
            <Text className="text-xs text-gray-600">{winPercent}%</Text>
         </View>

         <View className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <View
               className={[
                  "h-full",
                  isCheapest ? "bg-primary_green" : "bg-gray-400",
               ].join(" ")}
               style={{ width: `${winPercent}%` }}
            />
         </View>
      </View>
   );
}

function TableHeader({
   title,
   width,
   isLast,
}: {
   title: string;
   width: number;
   isLast?: boolean;
}) {
   return (
      <View
         className={[
            "px-6 py-4",
            isLast ? "" : "border-r border-gray-200",
         ].join(" ")}
         style={{ width }}
      >
         <Text className="text-xs font-semibold text-gray-700">{title}</Text>
      </View>
   );
}

function PriceCell({
   value,
   isBest,
   width = 120,
}: {
   value: number;
   isBest?: boolean;
   width?: number;
}) {
   return (
      <View
         className={[
            "px-4 py-4",
            isBest ? "bg-amber-50 border-l-4 border-amber-500" : "",
         ].join(" ")}
         style={{ width }}
      >
         <Text
            className={[
               "text-sm font-semibold",
               isBest ? "text-amber-700" : "text-gray-900",
            ].join(" ")}
         >
            ${value.toFixed(2)}
         </Text>
      </View>
   );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
   return (
      <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
         <Text className="text-sm text-gray-700">{label}</Text>
         <Text className="text-sm font-semibold text-gray-900">{value}</Text>
      </View>
   );
}
