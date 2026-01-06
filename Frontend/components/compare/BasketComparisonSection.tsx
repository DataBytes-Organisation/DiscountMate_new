import React, { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useRouter } from "expo-router";
import { useCart } from "../../app/(tabs)/CartContext";

type StoreKey = "aldi" | "coles" | "woolworths";

type BasketItem = {
   id: string;
   name: string;
   subtitle: string;
   qty: number;
   icon: string;
   prices: Record<StoreKey, number>; // per-item total for that qty (like the table)
};

// Helper function to generate store prices based on base price
// This creates realistic price variations across stores
const generateStorePrices = (basePrice: number, quantity: number): Record<StoreKey, number> => {
   // Generate prices with some variation: Aldi typically cheapest, then Coles, then Woolworths
   const aldiPrice = basePrice * 0.92; // ~8% cheaper
   const colesPrice = basePrice * 0.98; // ~2% cheaper
   const woolworthsPrice = basePrice; // base price

   return {
      aldi: aldiPrice * quantity,
      coles: colesPrice * quantity,
      woolworths: woolworthsPrice * quantity,
   };
};

// Helper to get icon based on product name
const getIconForProduct = (name: string): string => {
   const lowerName = name.toLowerCase();
   if (lowerName.includes("milk")) return "bottle-water";
   if (lowerName.includes("bread")) return "bread-slice";
   if (lowerName.includes("banana")) return "lemon";
   if (lowerName.includes("cheese")) return "cheese";
   if (lowerName.includes("pasta")) return "bowl-food";
   if (lowerName.includes("juice")) return "glass-water";
   return "bag-shopping";
};

export default function BasketComparisonSection() {
   const router = useRouter();
   const { cartItems, removeFromCart, updateQuantity } = useCart();

   // Convert cart items to basket items format with store prices
   const basketItems: BasketItem[] = useMemo(() => {
      return cartItems.map((item) => {
         const quantity = item.quantity || 1;
         const prices = generateStorePrices(item.price, quantity);

         return {
            id: item.id,
            name: item.name,
            subtitle: item.store || "Available at all stores",
            qty: quantity,
            icon: getIconForProduct(item.name),
            prices,
         };
      });
   }, [cartItems]);

   const bestStoreForItem = (item: BasketItem) => {
      const entries = Object.entries(item.prices) as [StoreKey, number][];
      entries.sort((a, b) => a[1] - b[1]);
      return entries[0][0];
   };

   const storeLabel = (k: StoreKey) =>
      k === "aldi" ? "Aldi" : k === "coles" ? "Coles" : "Woolworths";

   // Calculate store totals from basket items
   const storeTotals = useMemo(() => {
      const totals: Record<StoreKey, number> = {
         aldi: 0,
         coles: 0,
         woolworths: 0,
      };

      basketItems.forEach((item) => {
         totals.aldi += item.prices.aldi;
         totals.coles += item.prices.coles;
         totals.woolworths += item.prices.woolworths;
      });

      return totals;
   }, [basketItems]);

   // Find cheapest store
   const cheapestStore: StoreKey = useMemo(() => {
      const entries = Object.entries(storeTotals) as [StoreKey, number][];
      entries.sort((a, b) => a[1] - b[1]);
      return entries[0][0];
   }, [storeTotals]);

   const cheapestTotal = storeTotals[cheapestStore];
   const deltas = {
      coles: storeTotals.coles - cheapestTotal,
      woolworths: storeTotals.woolworths - cheapestTotal,
   };

   // Calculate wins per store
   const wins = useMemo(() => {
      const winCounts: Record<StoreKey, number> = {
         aldi: 0,
         coles: 0,
         woolworths: 0,
      };

      basketItems.forEach((item) => {
         const best = bestStoreForItem(item);
         winCounts[best]++;
      });

      return winCounts;
   }, [basketItems]);

   // For the progress bars in store totals card
   const winPercent = (store: StoreKey) => {
      const totalItems = basketItems.length;
      if (totalItems === 0) return 0;
      return Math.round((wins[store] / totalItems) * 100);
   };

   // Calculate savings summary
   const originalTotal = useMemo(() => {
      // Use highest store total as "original"
      return Math.max(storeTotals.coles, storeTotals.woolworths, storeTotals.aldi);
   }, [storeTotals]);

   const optimizedTotal = cheapestTotal;
   const totalSavings = originalTotal - optimizedTotal;
   const savingsFromDiscounts = totalSavings * 0.6; // 60% from discounts
   const savingsFromBestPrices = totalSavings * 0.4; // 40% from best prices

   return (
      <View className="px-4 md:px-8 py-10 bg-[#F9FAFB]">
         <View className="w-full">
            {/* Header */}
            <View className="flex-row items-start justify-between mb-8">
               <View>
                  <Text className="text-3xl font-bold text-gray-900 mb-2">
                     Grocery List Comparison
                  </Text>
                  <Text className="text-base text-gray-600">
                     Compare your grocery list total across all retailers
                  </Text>
               </View>

               <Pressable className="bg-primary_green rounded-2xl px-5 py-3 flex-row items-center gap-2 shadow-sm">
                  <FontAwesome6 name="arrows-rotate" size={14} color="#FFFFFF" />
                  <Text className="text-white font-semibold">Optimize Grocery List</Text>
               </Pressable>
            </View>

            {/* Top grid: Grocery List + Store totals */}
            <View className="flex-row gap-6 mb-8">
               {/* Your Grocery List */}
               <View className="flex-[2] bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
                  <View className="flex-row items-center justify-between mb-4">
                     <Text className="text-lg font-bold text-gray-900">
                        Your Grocery List{" "}
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
                     {basketItems.length === 0 ? (
                        <View className="px-4 py-12 items-center">
                           <FontAwesome6 name="list" size={32} color="#D1D5DB" />
                           <Text className="text-sm text-gray-500 mt-3">Your list is empty</Text>
                        </View>
                     ) : (
                        basketItems.map((item, idx) => (
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
                                 {/* Quantity controls */}
                                 <View className="flex-row items-center gap-2 border border-gray-200 rounded-lg">
                                    <Pressable
                                       onPress={() => updateQuantity(item.id, item.qty - 1)}
                                       className="px-2 py-1"
                                    >
                                       <FontAwesome6 name="minus" size={12} color="#6B7280" />
                                    </Pressable>
                                    <Text className="text-sm text-gray-700 font-semibold px-2">
                                       {item.qty}
                                    </Text>
                                    <Pressable
                                       onPress={() => updateQuantity(item.id, item.qty + 1)}
                                       className="px-2 py-1"
                                    >
                                       <FontAwesome6 name="plus" size={12} color="#6B7280" />
                                    </Pressable>
                                 </View>

                                 {/* Delete button */}
                                 <Pressable
                                    onPress={() => removeFromCart(item.id)}
                                    className="p-2"
                                 >
                                    <FontAwesome6 name="trash" size={14} color="#EF4444" />
                                 </Pressable>
                              </View>
                           </View>
                        ))
                     )}
                  </View>

                  {/* Add more products link */}
                  <Pressable
                     onPress={() => router.push("/")}
                     className="mt-4 flex-row items-center justify-center gap-2 py-3 border border-primary_green/30 rounded-xl bg-primary_green/5"
                  >
                     <FontAwesome6 name="plus" size={14} color="#10B981" />
                     <Text className="text-primary_green font-semibold text-sm">
                        Add more products
                     </Text>
                  </Pressable>
               </View>

               {/* Store Totals */}
               <View className="flex-1 bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
                  <Text className="text-lg font-bold text-gray-900 mb-4">
                     Store Totals
                  </Text>

                  {/* Aldi */}
                  <StoreTotalCard
                     store="Aldi"
                     total={storeTotals.aldi}
                     savings={cheapestStore === "aldi" ? totalSavings : undefined}
                     delta={cheapestStore !== "aldi" ? `+${(storeTotals.aldi - cheapestTotal).toFixed(2)}` : undefined}
                     isCheapest={cheapestStore === "aldi"}
                     winsText={`Wins on ${wins.aldi} items`}
                     winPercent={winPercent("aldi")}
                  />

                  {/* Coles */}
                  <StoreTotalCard
                     store="Coles"
                     total={storeTotals.coles}
                     savings={cheapestStore === "coles" ? totalSavings : undefined}
                     delta={cheapestStore !== "coles" ? `+${deltas.coles.toFixed(2)}` : undefined}
                     isCheapest={cheapestStore === "coles"}
                     winsText={`Wins on ${wins.coles} items`}
                     winPercent={winPercent("coles")}
                  />

                  {/* Woolworths */}
                  <StoreTotalCard
                     store="Woolworths"
                     total={storeTotals.woolworths}
                     savings={cheapestStore === "woolworths" ? totalSavings : undefined}
                     delta={cheapestStore !== "woolworths" ? `+${deltas.woolworths.toFixed(2)}` : undefined}
                     isCheapest={cheapestStore === "woolworths"}
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
                        {basketItems.length === 0 ? (
                           <View className="px-6 py-12 items-center">
                              <FontAwesome6 name="list" size={32} color="#D1D5DB" />
                              <Text className="text-sm text-gray-500 mt-3">No items to compare</Text>
                           </View>
                        ) : (
                           <>
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
                                          <View className="flex-row items-center gap-2 border border-gray-200 rounded-lg justify-center">
                                             <Pressable
                                                onPress={() => updateQuantity(item.id, item.qty - 1)}
                                                className="px-1.5 py-1"
                                             >
                                                <FontAwesome6 name="minus" size={10} color="#6B7280" />
                                             </Pressable>
                                             <Text className="text-sm text-gray-900 font-semibold">
                                                {item.qty}
                                             </Text>
                                             <Pressable
                                                onPress={() => updateQuantity(item.id, item.qty + 1)}
                                                className="px-1.5 py-1"
                                             >
                                                <FontAwesome6 name="plus" size={10} color="#6B7280" />
                                             </Pressable>
                                          </View>
                                       </View>

                                       <PriceCell value={item.prices.coles} isBest={best === "coles"} width={140} />
                                       <PriceCell value={item.prices.woolworths} isBest={best === "woolworths"} width={160} />
                                       <PriceCell value={item.prices.aldi} isBest={best === "aldi"} width={140} />
                                    </View>
                                 );
                              })}
                           </>
                        )}
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
                     <Text className="text-white font-semibold">
                        Shop at {storeLabel(cheapestStore)}
                     </Text>
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
