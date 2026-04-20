import React, { useMemo } from "react";
import { View, Text, Pressable, ScrollView, Image } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useRouter } from "expo-router";
import { useCart } from "../../app/(tabs)/CartContext";
import { useShoppingLists } from "../../app/(tabs)/ShoppingListsContext";
import type { ShoppingList } from "../../types/ShoppingList";

type StoreKey = "iga" | "coles" | "woolworths";

type BasketItem = {
   id: string;
   name: string;
   subtitle: string;
   qty: number;
   image?: string;
   icon: string;
   lineTotal: number;
   unitRetailerPrices?: {
      coles?: number;
      woolworths?: number;
      iga?: number;
   };
   prices: Record<StoreKey, number | null>; // per-item total for that qty
};

type BasketComparisonSectionProps = {
   selectedList?: ShoppingList | null;
   useStaticStoreTotals?: boolean;
};

// Helper function to generate store prices based on base price
// This creates realistic price variations across stores
const generateStorePrices = (basePrice: number, quantity: number): Record<StoreKey, number> => {
   // Generate prices with some variation across app-supported retailers.
   const colesPrice = basePrice * 0.98;
   const woolworthsPrice = basePrice;
   const igaPrice = basePrice * 1.02;

   return {
      coles: colesPrice * quantity,
      woolworths: woolworthsPrice * quantity,
      iga: igaPrice * quantity,
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

export default function BasketComparisonSection({
   selectedList,
   useStaticStoreTotals = false,
}: BasketComparisonSectionProps) {
   const router = useRouter();
   const { cartItems, updateQuantity } = useCart();
   const {
      getActiveList,
      updateListItemQuantity,
      updateListItemRetailer,
   } = useShoppingLists();
   const activeList = getActiveList();
   const activeListName = activeList?.name ?? "Your Grocery List";
   const displayedListName = selectedList?.name ?? activeListName;
   const sourceItems =
      selectedList?.items ??
      cartItems.map((item) => ({
         id: item.id,
         name: item.name,
         price: item.price,
         quantity: item.quantity || 1,
         store: item.store,
         image: item.image,
         retailerPrices: item.retailerPrices,
      }));

   // Convert cart items to basket items format with store prices
   const basketItems: BasketItem[] = useMemo(() => {
      return sourceItems.map((item) => {
         const quantity = item.quantity || 1;
         const prices = generateStorePrices(item.price, quantity);

         return {
            id: item.id,
            name: item.name,
            subtitle: item.store || "Available at all stores",
            qty: quantity,
            image: item.image,
            icon: getIconForProduct(item.name),
            lineTotal: item.price * quantity,
            unitRetailerPrices: item.retailerPrices,
            prices: {
               coles:
                  typeof item.retailerPrices?.coles === "number"
                     ? item.retailerPrices.coles * quantity
                     : null,
               woolworths:
                  typeof item.retailerPrices?.woolworths === "number"
                     ? item.retailerPrices.woolworths * quantity
                     : null,
               iga:
                  typeof item.retailerPrices?.iga === "number"
                     ? item.retailerPrices.iga * quantity
                     : null,
            },
         };
      });
   }, [sourceItems]);

   const targetListId = selectedList?.id ?? activeList?.id ?? null;

   const bestStoreForItem = (item: BasketItem): StoreKey | null => {
      const entries = (Object.entries(item.prices) as [StoreKey, number | null][])
         .filter(([, price]) => typeof price === "number" && !isNaN(price));
      if (entries.length === 0) return null;
      entries.sort((a, b) => a[1] - b[1]);
      return entries[0][0];
   };

   const selectedStoreForItem = (item: BasketItem): StoreKey | null => {
      const normalized = item.subtitle.toLowerCase();
      if (normalized.includes("coles")) return "coles";
      if (normalized.includes("woolworths")) return "woolworths";
      if (normalized.includes("iga")) return "iga";
      return null;
   };

   const storeLabel = (k: StoreKey) =>
      k === "iga" ? "IGA" : k === "coles" ? "Coles" : "Woolworths";

   // Calculate store totals from basket items.
   const storeTotals = useMemo(() => {
      if (useStaticStoreTotals) {
         return {
            iga: 123.0,
            coles: 131.03,
            woolworths: 133.7,
         };
      }

      const totals: Record<StoreKey, number> = {
         iga: 0,
         coles: 0,
         woolworths: 0,
      };

      basketItems.forEach((item) => {
         const selectedStore = selectedStoreForItem(item);
         if (!selectedStore) return;
         totals[selectedStore] += item.lineTotal;
      });

      return totals;
   }, [basketItems, useStaticStoreTotals]);

   // Compute savings per retailer as:
   // sum(highest competitor price - retailer price) across all items.
   const savingsByStore = useMemo(() => {
      const savings: Record<StoreKey, number> = {
         iga: 0,
         coles: 0,
         woolworths: 0,
      };

      basketItems.forEach((item) => {
         const stores: StoreKey[] = ["iga", "coles", "woolworths"];
         stores.forEach((store) => {
            const currentPrice = item.prices[store];
            if (typeof currentPrice !== "number" || isNaN(currentPrice)) return;

            const competitorPrices = stores
               .filter((competitor) => competitor !== store)
               .map((competitor) => item.prices[competitor])
               .filter((price): price is number => typeof price === "number" && !isNaN(price));

            if (competitorPrices.length === 0) return;
            const highestCompetitorPrice = Math.max(...competitorPrices);
            savings[store] += Math.max(0, highestCompetitorPrice - currentPrice);
         });
      });

      return savings;
   }, [basketItems]);

   // Tag "Cheapest" as the retailer with the biggest computed savings.
   const cheapestStore: StoreKey = useMemo(() => {
      const entries = Object.entries(savingsByStore) as [StoreKey, number][];
      entries.sort((a, b) => b[1] - a[1]);
      return entries[0][0];
   }, [savingsByStore]);

   const cheapestTotal = storeTotals[cheapestStore];
   const deltas = {
      coles: storeTotals.coles - cheapestTotal,
      woolworths: storeTotals.woolworths - cheapestTotal,
   };

   // Calculate wins per store
   const wins = useMemo(() => {
      if (useStaticStoreTotals) {
         return {
            iga: 6,
            coles: 0,
            woolworths: 0,
         } satisfies Record<StoreKey, number>;
      }

      const winCounts: Record<StoreKey, number> = {
         iga: 0,
         coles: 0,
         woolworths: 0,
      };

      basketItems.forEach((item) => {
         const best = bestStoreForItem(item);
         winCounts[best]++;
      });

      return winCounts;
   }, [basketItems, useStaticStoreTotals]);

   // For the progress bars in store totals card
   const winPercent = (store: StoreKey) => {
      if (useStaticStoreTotals) {
         return store === "iga" ? 100 : 0;
      }

      const totalItems = basketItems.length;
      if (totalItems === 0) return 0;
      return Math.round((wins[store] / totalItems) * 100);
   };

   // Calculate savings summary
   const originalTotal = useMemo(() => {
      // Use highest store total as "original"
      return Math.max(storeTotals.coles, storeTotals.woolworths, storeTotals.iga);
   }, [storeTotals]);

   const optimizedTotal = cheapestTotal;
   const totalSavings = savingsByStore[cheapestStore];

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
                        {displayedListName}{" "}
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
                              <View className="w-12 h-12 rounded-xl bg-gray-100 items-center justify-center mr-4 overflow-hidden">
                                 {item.image ? (
                                    <Image
                                       source={{ uri: item.image }}
                                       style={{ width: "100%", height: "100%" }}
                                       resizeMode="cover"
                                    />
                                 ) : (
                                    <FontAwesome6 name={item.icon as any} size={16} color="#9CA3AF" />
                                 )}
                              </View>

                              <View className="flex-1">
                                 <Text className="font-semibold text-gray-900">{item.name}</Text>
                                 <Text className="text-xs text-gray-500 mt-1">{item.subtitle}</Text>
                              </View>

                              <View className="flex-row items-center gap-3">
                                 <Text className="text-sm font-semibold text-gray-900 min-w-[72px] text-right">
                                    ${item.lineTotal.toFixed(2)}
                                 </Text>
                                 {/* Quantity controls */}
                                 <View className="flex-row items-center gap-2 border border-gray-200 rounded-lg">
                                    <Pressable
                                       onPress={() => {
                                          if (targetListId) {
                                             updateListItemQuantity(targetListId, item.id, item.qty - 1);
                                          } else {
                                             updateQuantity(item.id, item.qty - 1);
                                          }
                                       }}
                                       className="px-2 py-1"
                                    >
                                       <FontAwesome6 name="minus" size={12} color="#6B7280" />
                                    </Pressable>
                                    <Text className="text-sm text-gray-700 font-semibold px-2">
                                       {item.qty}
                                    </Text>
                                    <Pressable
                                       onPress={() => {
                                          if (targetListId) {
                                             updateListItemQuantity(targetListId, item.id, item.qty + 1);
                                          } else {
                                             updateQuantity(item.id, item.qty + 1);
                                          }
                                       }}
                                       className="px-2 py-1"
                                    >
                                       <FontAwesome6 name="plus" size={12} color="#6B7280" />
                                    </Pressable>
                                 </View>
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

                  {/* IGA */}
                  <StoreTotalCard
                     store="IGA"
                     total={storeTotals.iga}
                     savings={savingsByStore.iga}
                     delta={cheapestStore !== "iga" ? `+${(storeTotals.iga - cheapestTotal).toFixed(2)}` : undefined}
                     isCheapest={cheapestStore === "iga"}
                     winsText={`Wins on ${wins.iga} items`}
                     winPercent={winPercent("iga")}
                  />

                  {/* Coles */}
                  <StoreTotalCard
                     store="Coles"
                     total={storeTotals.coles}
                     savings={savingsByStore.coles}
                     delta={cheapestStore !== "coles" ? `+${deltas.coles.toFixed(2)}` : undefined}
                     isCheapest={cheapestStore === "coles"}
                     winsText={`Wins on ${wins.coles} items`}
                     winPercent={winPercent("coles")}
                  />

                  {/* Woolworths */}
                  <StoreTotalCard
                     store="Woolworths"
                     total={storeTotals.woolworths}
                     savings={savingsByStore.woolworths}
                     delta={cheapestStore !== "woolworths" ? `+${deltas.woolworths.toFixed(2)}` : undefined}
                     isCheapest={cheapestStore === "woolworths"}
                     winsText={`Wins on ${wins.woolworths} items`}
                     winPercent={winPercent("woolworths")}
                  />
               </View>
            </View>

            <View className="flex-row gap-6">
               <View className="w-full bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
                  <View className="px-6 py-4 border-b border-gray-300 bg-gray-200">
                     <View className="flex-row items-start justify-between gap-4">
                        <View className="flex-1 min-w-0">
                           <Text className="text-lg font-bold text-gray-900">
                              Item-by-Item Breakdown
                           </Text>
                           <Text className="text-xs text-gray-600 mt-1">
                              Tap a retailer price to apply it across this list.
                           </Text>
                        </View>
                        <View className="px-2.5 py-1 rounded-full bg-white border border-gray-300">
                           <Text className="text-[11px] font-semibold text-gray-700">
                              Interactive pricing
                           </Text>
                        </View>
                     </View>
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
                                 <TableHeader title="Item" width={420} />
                                 <TableHeader title="Coles" width={190} />
                                 <TableHeader title="Woolworths" width={190} />
                                 <TableHeader title="IGA" width={190} isLast />
                              </View>

                              {/* Rows */}
                              {basketItems.map((item, idx) => {
                                 const best = bestStoreForItem(item);
                                 const selectedStore = selectedStoreForItem(item);

                                 return (
                                    <View
                                       key={item.id}
                                       className={[
                                          "flex-row",
                                          idx < basketItems.length - 1 ? "border-b border-gray-100" : "",
                                       ].join(" ")}
                                    >
                                       <View className="w-[420px] px-6 py-4">
                                          <View className="flex-row items-center gap-3">
                                             <View className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden items-center justify-center">
                                                {item.image ? (
                                                   <Image
                                                      source={{ uri: item.image }}
                                                      style={{ width: "100%", height: "100%" }}
                                                      resizeMode="cover"
                                                   />
                                                ) : (
                                                   <FontAwesome6 name={item.icon as any} size={14} color="#9CA3AF" />
                                                )}
                                             </View>
                                             <View className="flex-1 min-w-0">
                                                <Text className="text-sm font-semibold text-gray-900" numberOfLines={2}>
                                                   {item.name}
                                                </Text>
                                                <Text className="text-xs text-gray-500 mt-0.5">
                                                   Qty {item.qty}
                                                </Text>
                                             </View>
                                          </View>
                                       </View>

                                       <PriceCell
                                          value={item.prices.coles}
                                          width={190}
                                          isSelected={selectedStore === "coles"}
                                          isCheapest={best === "coles"}
                                          onPress={() => {
                                             if (!targetListId || item.prices.coles == null) return;
                                             updateListItemRetailer(targetListId, item.id, "coles");
                                          }}
                                       />
                                       <PriceCell
                                          value={item.prices.woolworths}
                                          width={190}
                                          isSelected={selectedStore === "woolworths"}
                                          isCheapest={best === "woolworths"}
                                          onPress={() => {
                                             if (!targetListId || item.prices.woolworths == null) return;
                                             updateListItemRetailer(targetListId, item.id, "woolworths");
                                          }}
                                       />
                                       <PriceCell
                                          value={item.prices.iga}
                                          width={190}
                                          isSelected={selectedStore === "iga"}
                                          isCheapest={best === "iga"}
                                          onPress={() => {
                                             if (!targetListId || item.prices.iga == null) return;
                                             updateListItemRetailer(targetListId, item.id, "iga");
                                          }}
                                       />
                                    </View>
                                 );
                              })}
                           </>
                        )}
                     </View>
                  </ScrollView>
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
   isSelected,
   isCheapest,
   onPress,
   width = 120,
}: {
   value: number | null;
   isSelected?: boolean;
   isCheapest?: boolean;
   onPress?: () => void;
   width?: number;
}) {
   const selectedClass = isSelected
      ? isCheapest
         ? "bg-amber-50 border-l-4 border-amber-500"
         : "bg-gray-100 border-l-4 border-gray-400"
      : "";

   const textClass = isSelected
      ? isCheapest
         ? "text-amber-700"
         : "text-gray-700"
      : "text-gray-900";

   return (
      <Pressable
         onPress={onPress}
         disabled={!onPress || value == null}
         className={[
            "px-4 py-4",
            selectedClass,
         ].join(" ")}
         style={{ width }}
      >
         <Text
            className={[
               "text-sm font-semibold",
               textClass,
            ].join(" ")}
         >
            {typeof value === "number" ? `$${value.toFixed(2)}` : "-"}
         </Text>
      </Pressable>
   );
}

