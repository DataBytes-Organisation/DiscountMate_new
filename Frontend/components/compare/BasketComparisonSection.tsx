import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Image, Modal } from "react-native";
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
      getListById,
      updateListItemQuantity,
      updateListItemRetailer,
      updateListItemsRetailers,
   } = useShoppingLists();
   const activeList = getActiveList();
   const liveSelectedList = selectedList?.id ? getListById(selectedList.id) ?? selectedList : selectedList;
   const activeListName = activeList?.name ?? "Your Grocery List";
   const displayedListName = liveSelectedList?.name ?? activeListName;
   const [previewItem, setPreviewItem] = useState<BasketItem | null>(null);
   const sourceItems =
      liveSelectedList?.items ??
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
         const selectedStoreName = (item.store ?? "").toLowerCase();
         const selectedStore =
            selectedStoreName.includes("coles")
               ? "coles"
               : selectedStoreName.includes("woolworths")
                  ? "woolworths"
                  : selectedStoreName.includes("iga")
                     ? "iga"
                     : null;

         const priceForStore = (store: StoreKey) => {
            const retailerPrice = item.retailerPrices?.[store];
            if (typeof retailerPrice === "number" && !isNaN(retailerPrice) && retailerPrice > 0) {
               return retailerPrice * quantity;
            }

            if (selectedStore === store && item.price > 0) {
               return item.price * quantity;
            }

            return null;
         };

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
               coles: priceForStore("coles"),
               woolworths: priceForStore("woolworths"),
               iga: priceForStore("iga"),
            },
         };
      });
   }, [sourceItems]);

   const targetListId = liveSelectedList?.id ?? activeList?.id ?? null;

   const bestStoreForItem = (item: BasketItem): StoreKey | null => {
      const entries = (Object.entries(item.prices) as [StoreKey, number | null][])
         .filter(([, price]) => typeof price === "number" && !isNaN(price));
      if (entries.length === 0) return null;
      entries.sort((a, b) => a[1] - b[1]);
      return entries[0][0];
   };

   const isCheapestStoreForItem = (item: BasketItem, store: StoreKey) => {
      const currentPrice = item.prices[store];
      if (typeof currentPrice !== "number" || isNaN(currentPrice)) return false;

      const availablePrices = Object.values(item.prices).filter(
         (price): price is number => typeof price === "number" && !isNaN(price)
      );
      if (availablePrices.length === 0) return false;

      const cheapestPrice = Math.min(...availablePrices);
      return Math.abs(currentPrice - cheapestPrice) < 0.005;
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

   const previewRetailers = useMemo(() => {
      if (!previewItem) return [];

      const rows = (Object.entries(previewItem.prices) as [StoreKey, number | null][])
         .map(([store, price]) => ({
            store,
            label: storeLabel(store),
            price,
            isSelected: selectedStoreForItem(previewItem) === store,
            isCheapest: isCheapestStoreForItem(previewItem, store),
         }));

      return rows;
   }, [previewItem]);

   // Calculate each retailer's total if the full list were bought there.
   const fullStoreTotals = useMemo(() => {
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
         (Object.entries(item.prices) as [StoreKey, number | null][]).forEach(([store, price]) => {
            if (typeof price !== "number" || isNaN(price)) return;
            totals[store] += price;
         });
      });

      return totals;
   }, [basketItems, useStaticStoreTotals]);

   // Calculate each retailer's actual total based on the current list allocation.
   const storeTotals = useMemo(() => {
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
   }, [basketItems]);

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

   const allocationSavingsByStore = useMemo(() => {
      const savings: Record<StoreKey, number> = {
         iga: 0,
         coles: 0,
         woolworths: 0,
      };

      basketItems.forEach((item) => {
         const selectedStore = selectedStoreForItem(item);
         if (!selectedStore) return;

         const selectedPrice = item.prices[selectedStore];
         if (typeof selectedPrice !== "number" || isNaN(selectedPrice)) return;

         const availablePrices = Object.values(item.prices).filter(
            (price): price is number => typeof price === "number" && !isNaN(price)
         );
         if (availablePrices.length === 0) return;

         savings[selectedStore] += Math.max(0, Math.max(...availablePrices) - selectedPrice);
      });

      return savings;
   }, [basketItems]);

   // Tag "Cheapest" as the retailer with the lowest full-list total.
   const cheapestStore: StoreKey = useMemo(() => {
      const entries = Object.entries(fullStoreTotals) as [StoreKey, number][];
      entries.sort((a, b) => a[1] - b[1]);
      return entries[0][0];
   }, [fullStoreTotals]);

   const cheapestTotal = fullStoreTotals[cheapestStore];
   const deltas = {
      iga: fullStoreTotals.iga - cheapestTotal,
      coles: fullStoreTotals.coles - cheapestTotal,
      woolworths: fullStoreTotals.woolworths - cheapestTotal,
   };

   // Calculate selected item counts per store for the current list allocation.
   const selectedCounts = useMemo(() => {
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
         const selectedStore = selectedStoreForItem(item);
         if (!selectedStore) return;
         winCounts[selectedStore]++;
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
      return Math.round((selectedCounts[store] / totalItems) * 100);
   };

   // Calculate savings summary
   const originalTotal = useMemo(() => {
      // Use highest store total as "original"
      return Math.max(storeTotals.coles, storeTotals.woolworths, storeTotals.iga);
   }, [storeTotals]);

   const optimizedTotal = cheapestTotal;
   const totalSavings = savingsByStore[cheapestStore];

   const optimizeGroceryList = () => {
      if (!targetListId || basketItems.length === 0) return;

      const retailersByItemId = basketItems.reduce<Record<string, StoreKey>>((acc, item) => {
         const bestStore = bestStoreForItem(item);
         if (bestStore) {
            acc[item.id] = bestStore;
         }
         return acc;
      }, {});

      updateListItemsRetailers(targetListId, retailersByItemId);
   };

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

               <Pressable
                  onPress={optimizeGroceryList}
                  disabled={!targetListId || basketItems.length === 0}
                  className={`bg-primary_green rounded-2xl px-5 py-3 flex-row items-center gap-2 shadow-sm ${
                     !targetListId || basketItems.length === 0 ? "opacity-60" : ""
                  }`}
               >
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
                              <Pressable
                                 onPress={() => setPreviewItem(item)}
                                 className="flex-1 flex-row items-center"
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
                              </Pressable>

                              <View className="flex-row items-center gap-3">
                                 <Pressable onPress={() => setPreviewItem(item)}>
                                    <Text className="text-sm font-semibold text-gray-900 min-w-[72px] text-right">
                                    ${item.lineTotal.toFixed(2)}
                                    </Text>
                                 </Pressable>
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
                     savings={allocationSavingsByStore.iga}
                     delta={cheapestStore !== "iga" ? `+${deltas.iga.toFixed(2)}` : undefined}
                     isCheapest={cheapestStore === "iga"}
                     winsText={`Selected for ${selectedCounts.iga} items`}
                     winPercent={winPercent("iga")}
                  />

                  {/* Coles */}
                  <StoreTotalCard
                     store="Coles"
                     total={storeTotals.coles}
                     savings={allocationSavingsByStore.coles}
                     delta={cheapestStore !== "coles" ? `+${deltas.coles.toFixed(2)}` : undefined}
                     isCheapest={cheapestStore === "coles"}
                     winsText={`Selected for ${selectedCounts.coles} items`}
                     winPercent={winPercent("coles")}
                  />

                  {/* Woolworths */}
                  <StoreTotalCard
                     store="Woolworths"
                     total={storeTotals.woolworths}
                     savings={allocationSavingsByStore.woolworths}
                     delta={cheapestStore !== "woolworths" ? `+${deltas.woolworths.toFixed(2)}` : undefined}
                     isCheapest={cheapestStore === "woolworths"}
                     winsText={`Selected for ${selectedCounts.woolworths} items`}
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
                                          isCheapest={isCheapestStoreForItem(item, "coles")}
                                          onPress={() => {
                                             if (!targetListId || item.prices.coles == null) return;
                                             updateListItemRetailer(targetListId, item.id, "coles");
                                          }}
                                       />
                                       <PriceCell
                                          value={item.prices.woolworths}
                                          width={190}
                                          isSelected={selectedStore === "woolworths"}
                                          isCheapest={isCheapestStoreForItem(item, "woolworths")}
                                          onPress={() => {
                                             if (!targetListId || item.prices.woolworths == null) return;
                                             updateListItemRetailer(targetListId, item.id, "woolworths");
                                          }}
                                       />
                                       <PriceCell
                                          value={item.prices.iga}
                                          width={190}
                                          isSelected={selectedStore === "iga"}
                                          isCheapest={isCheapestStoreForItem(item, "iga")}
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
         <Modal
            visible={previewItem != null}
            transparent
            animationType="fade"
            onRequestClose={() => setPreviewItem(null)}
         >
            <Pressable
               className="flex-1 bg-black/45 items-center justify-center px-4"
               onPress={() => setPreviewItem(null)}
            >
               <Pressable
                  className="w-full max-w-[700px]"
                  onPress={(event) => event.stopPropagation()}
               >
                  <View className="mb-3 flex-row justify-end">
                     <Pressable
                        onPress={() => setPreviewItem(null)}
                        className="w-9 h-9 rounded-full bg-white/95 border border-gray-200 items-center justify-center"
                     >
                        <FontAwesome6 name="xmark" size={16} color="#111827" />
                     </Pressable>
                  </View>

                  {previewItem ? (
                     <View className="rounded-2xl border border-gray-200 bg-white p-4">
                        <View className="flex-row items-start gap-4">
                           <View className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 items-center justify-center">
                              {previewItem.image ? (
                                 <Image
                                    source={{ uri: previewItem.image }}
                                    style={{ width: "100%", height: "100%" }}
                                    resizeMode="cover"
                                 />
                              ) : (
                                 <FontAwesome6 name={previewItem.icon as any} size={18} color="#9CA3AF" />
                              )}
                           </View>
                           <View className="flex-1 min-w-0">
                              <Text className="text-xl font-bold text-gray-900" numberOfLines={2}>
                                 {previewItem.name}
                              </Text>
                              <Text className="text-sm text-gray-500 mt-1">
                                 Selected retailer: {previewItem.subtitle}
                              </Text>
                              <Text className="text-sm text-gray-500">Quantity: {previewItem.qty}</Text>
                              <Text className="text-base font-bold text-gray-900 mt-2">
                                 Selected total: ${previewItem.lineTotal.toFixed(2)}
                              </Text>
                           </View>
                        </View>

                        <View className="mt-4 border-t border-gray-100 pt-3">
                           <Text className="text-xs font-semibold uppercase text-gray-500 mb-2">
                              Retailer totals
                           </Text>
                           <View className="flex-row gap-2">
                              {previewRetailers.map((retailer) => (
                                 <View
                                    key={retailer.store}
                                    className={`flex-1 rounded-lg px-3 py-2 border ${
                                       retailer.isCheapest
                                          ? "border-amber-300 bg-amber-50"
                                          : retailer.isSelected
                                             ? "border-gray-300 bg-gray-50"
                                             : "border-gray-200 bg-white"
                                    }`}
                                 >
                                    <Text className="text-xs text-gray-500">{retailer.label}</Text>
                                    <Text
                                       className={`text-base font-bold ${
                                          retailer.isCheapest ? "text-amber-700" : "text-gray-900"
                                       }`}
                                    >
                                       {typeof retailer.price === "number"
                                          ? `$${retailer.price.toFixed(2)}`
                                          : "-"}
                                    </Text>
                                    {retailer.isSelected ? (
                                       <Text className="text-[11px] font-semibold text-primary_green mt-1">
                                          Selected
                                       </Text>
                                    ) : null}
                                 </View>
                              ))}
                           </View>
                        </View>
                     </View>
                  ) : null}
               </Pressable>
            </Pressable>
         </Modal>
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

