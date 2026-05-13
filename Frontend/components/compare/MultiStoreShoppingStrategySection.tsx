import React, { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, Image } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import type { ShoppingList } from "../../types/ShoppingList";

type StoreKey = "coles" | "woolworths" | "iga";

const STORES: StoreKey[] = ["coles", "woolworths", "iga"];

function storeLabel(store: StoreKey) {
   if (store === "iga") return "IGA";
   if (store === "coles") return "Coles";
   return "Woolworths";
}

type MultiStoreShoppingStrategySectionProps = {
   selectedList?: ShoppingList | null;
};

export default function MultiStoreShoppingStrategySection({
   selectedList,
}: MultiStoreShoppingStrategySectionProps) {
   const [splitPlanOpen, setSplitPlanOpen] = useState(false);
   const [singleStoreMenuOpen, setSingleStoreMenuOpen] = useState(false);
   const [selectedSingleStore, setSelectedSingleStore] = useState<StoreKey | null>(null);
   const items = selectedList?.items ?? [];

   const storeTotals = STORES.reduce<Record<StoreKey, number | null>>((totals, store) => {
      let total = 0;

      for (const item of items) {
         const price = item.retailerPrices?.[store];
         if (typeof price !== "number" || price <= 0) {
            totals[store] = null;
            return totals;
         }

         total += price * item.quantity;
      }

      totals[store] = total;
      return totals;
   }, { coles: null, woolworths: null, iga: null });

   const singleStoreEntries = STORES
      .map((store) => ({ store, total: storeTotals[store] }))
      .filter((entry): entry is { store: StoreKey; total: number } => typeof entry.total === "number")
      .sort((a, b) => a.total - b.total);
   const singleStoreOptions = STORES.map((store) => ({
      store,
      total: storeTotals[store],
      isAvailable: typeof storeTotals[store] === "number",
   }));

   const cheapestSingleStore = singleStoreEntries[0] ?? null;
   const selectedSingleStoreEntry =
      singleStoreEntries.find((entry) => entry.store === selectedSingleStore) ??
      cheapestSingleStore;

   const multiStorePlan = items.flatMap((item) => {
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
         itemId: item.id,
         name: item.name,
         image: item.image,
         quantity: item.quantity,
         store: best.store,
         unitPrice: best.price,
         lineTotal: best.price * item.quantity,
      }];
   });

   const multiStoreTotal = multiStorePlan.reduce((sum, item) => sum + item.lineTotal, 0);
   const multiStoreStoresToVisit = new Set(multiStorePlan.map((item) => item.store)).size;
   const highestAvailableTotal = items.reduce((sum, item) => {
      const prices = STORES
         .map((store) => item.retailerPrices?.[store])
         .filter((price): price is number => typeof price === "number" && price > 0);

      if (prices.length === 0) return sum;
      return sum + Math.max(...prices) * item.quantity;
   }, 0);
   const singleStoreExtraCost = selectedSingleStoreEntry
      ? Math.max(0, selectedSingleStoreEntry.total - multiStoreTotal)
      : 0;

   const singleStore = {
      totalCost: selectedSingleStoreEntry?.total ?? 0,
      extraCost: singleStoreExtraCost,
      storesToVisit: selectedSingleStoreEntry ? 1 : 0,
      storeName: selectedSingleStoreEntry ? storeLabel(selectedSingleStoreEntry.store) : "N/A",
   };

   const multiStore = {
      totalCost: multiStoreTotal,
      savings: Math.max(0, highestAvailableTotal - multiStoreTotal),
      storesToVisit: multiStoreStoresToVisit,
   };

   const multiStoreSavingsLabel = multiStore.savings.toFixed(2);
   const splitPlanByStore = STORES.map((store) => {
      const storeItems = multiStorePlan.filter((item) => item.store === store);
      return {
         store,
         items: storeItems,
         subtotal: storeItems.reduce((sum, item) => sum + item.lineTotal, 0),
      };
   });

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
            <View className="relative bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
               {singleStoreMenuOpen ? (
                  <Pressable
                     onPress={() => setSingleStoreMenuOpen(false)}
                     className="absolute inset-0 z-10"
                     style={{ zIndex: 10, elevation: 10 }}
                  />
               ) : null}
               <View className="relative z-20 flex-row gap-6" style={{ zIndex: 20, elevation: 20 }}>
                  {/* Single store column */}
                  <View className="flex-1">
                     <View className="flex-row items-center gap-4 mb-6 z-50" style={{ zIndex: 100, elevation: 100 }}>
                        <View className="w-12 h-12 rounded-2xl bg-gray-100 items-center justify-center shadow-sm">
                           <FontAwesome6 name="store" size={18} color="#6B7280" />
                        </View>
                        <View>
                           <Text className="text-lg font-bold text-gray-900">
                              Single Store Shopping
                           </Text>
                           <View className="relative z-50" style={{ zIndex: 100, elevation: 100 }}>
                              <Pressable
                                 onPress={() => setSingleStoreMenuOpen((open) => !open)}
                                 className="mt-1 flex-row items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
                              >
                                 <Text className="text-sm text-gray-700">
                                    Shop everything at{" "}
                                    <Text className="font-bold text-gray-900">{singleStore.storeName}</Text>
                                 </Text>
                                 <FontAwesome6 name="chevron-down" size={10} color="#6B7280" />
                              </Pressable>

                              {singleStoreMenuOpen ? (
                                 <View className="absolute left-0 top-11 z-50 w-56 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden" style={{ zIndex: 100, elevation: 100 }}>
                                    {singleStoreEntries.length === 0 ? (
                                       <View className="px-3 py-3">
                                          <Text className="text-xs text-gray-500">No complete single-store option</Text>
                                       </View>
                                    ) : (
                                       singleStoreOptions.map((entry) => (
                                          <Pressable
                                             key={entry.store}
                                             onPress={() => {
                                                if (!entry.isAvailable) return;
                                                setSelectedSingleStore(entry.store);
                                                setSingleStoreMenuOpen(false);
                                             }}
                                             disabled={!entry.isAvailable}
                                             className={`px-3 py-3 ${
                                                entry.store === selectedSingleStoreEntry?.store
                                                   ? "bg-emerald-50"
                                                   : "bg-white"
                                             } ${entry.isAvailable ? "" : "opacity-50"}`}
                                          >
                                             <View className="flex-row items-center justify-between">
                                                <Text className="text-sm font-semibold text-gray-900">
                                                   {storeLabel(entry.store)}
                                                </Text>
                                                <Text className="text-xs font-bold text-gray-600">
                                                   {typeof entry.total === "number"
                                                      ? `$${entry.total.toFixed(2)}`
                                                      : "Unavailable"}
                                                </Text>
                                             </View>
                                          </Pressable>
                                       ))
                                    )}
                                 </View>
                              ) : null}
                           </View>
                        </View>
                     </View>

                     <MetricRow
                        label="Total cost"
                        value={`$${singleStore.totalCost.toFixed(2)}`}
                        variant="neutral"
                     />
                     <MetricRow
                        label={singleStore.extraCost > 0 ? "Extra cost vs optimal" : "Matches optimal"}
                        value={
                           singleStore.extraCost > 0
                              ? `+$${singleStore.extraCost.toFixed(2)}`
                              : "$0.00"
                        }
                        variant={singleStore.extraCost > 0 ? "danger" : "neutralGreenValue"}
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
                        variant="gold"
                     />
                     <MetricRow
                        label="Savings"
                        value={`$${multiStore.savings.toFixed(2)}`}
                        variant="highlight"
                     />
                     <MetricRow
                        label="Stores to visit"
                        value={`${multiStore.storesToVisit}`}
                        variant="neutral"
                        noMargin
                     />
                  </View>
               </View>

               {/* Orange banner */}
               <View className="mt-8 bg-amber-700 rounded-3xl px-8 py-7 flex-row items-center justify-between">
                  <View className="flex-1 pr-6">
                     <Text className="text-white text-lg font-bold mb-2">
                        Multi-store savings: ${multiStoreSavingsLabel}
                     </Text>
                     <Text className="text-white/90 text-sm">
                        Shop smarter across stores for your selected list
                     </Text>
                  </View>

                  <Pressable
                     onPress={() => setSplitPlanOpen(true)}
                     disabled={multiStorePlan.length === 0}
                     className={`bg-white rounded-2xl px-6 py-4 shadow-sm ${
                        multiStorePlan.length === 0 ? "opacity-60" : ""
                     }`}
                  >
                     <Text className="text-gray-900 font-semibold">View Split Plan</Text>
                  </Pressable>
               </View>
            </View>
         </View>

         <Modal
            visible={splitPlanOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setSplitPlanOpen(false)}
         >
            <Pressable
               className="flex-1 bg-black/45 items-center justify-center px-4"
               onPress={() => setSplitPlanOpen(false)}
            >
               <Pressable
                  className="w-full max-w-[900px]"
                  onPress={(event) => event.stopPropagation()}
               >
                  <View className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-xl">
                     <View className="px-6 py-5 border-b border-gray-100 flex-row items-start justify-between">
                        <View className="flex-1 pr-4">
                           <Text className="text-2xl font-bold text-gray-900">Multi-store split plan</Text>
                           <Text className="text-sm text-gray-600 mt-1">
                              Buy each product from the retailer with the best available price.
                           </Text>
                        </View>
                        <Pressable
                           onPress={() => setSplitPlanOpen(false)}
                           className="w-9 h-9 rounded-full bg-gray-50 border border-gray-200 items-center justify-center"
                        >
                           <FontAwesome6 name="xmark" size={16} color="#111827" />
                        </Pressable>
                     </View>

                     <ScrollView className="max-h-[70vh]">
                        {multiStorePlan.length === 0 ? (
                           <View className="px-6 py-12 items-center">
                              <FontAwesome6 name="list" size={28} color="#D1D5DB" />
                              <Text className="text-sm text-gray-500 mt-3">
                                 No split plan available for this list.
                              </Text>
                           </View>
                        ) : (
                           <View className="flex-row gap-4 p-5">
                              {splitPlanByStore.map((group) => (
                                 <View
                                    key={group.store}
                                    className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden"
                                 >
                                    <View className="px-4 py-3 border-b border-gray-200 bg-white">
                                       <View className="flex-row items-center justify-between">
                                          <Text className="text-base font-bold text-gray-900">
                                             {storeLabel(group.store)}
                                          </Text>
                                          <Text className="text-xs font-semibold text-primary_green">
                                             ${group.subtotal.toFixed(2)}
                                          </Text>
                                       </View>
                                       <Text className="text-xs text-gray-500 mt-1">
                                          {group.items.length} product{group.items.length === 1 ? "" : "s"}
                                       </Text>
                                    </View>

                                    <View className="p-3 gap-3">
                                       {group.items.length === 0 ? (
                                          <View className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-6 items-center">
                                             <Text className="text-xs text-gray-400 text-center">
                                                No cheapest items
                                             </Text>
                                          </View>
                                       ) : (
                                          group.items.map((row) => (
                                             <View
                                                key={row.itemId}
                                                className="rounded-xl border border-gray-200 bg-white p-3"
                                             >
                                                <View className="flex-row gap-3">
                                                   <View className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden items-center justify-center">
                                                      {row.image ? (
                                                         <Image
                                                            source={{ uri: row.image }}
                                                            style={{ width: "100%", height: "100%" }}
                                                            resizeMode="cover"
                                                         />
                                                      ) : (
                                                         <FontAwesome6 name="bag-shopping" size={14} color="#9CA3AF" />
                                                      )}
                                                   </View>
                                                   <View className="flex-1 min-w-0">
                                                      <Text className="text-sm font-semibold text-gray-900" numberOfLines={2}>
                                                         {row.name}
                                                      </Text>
                                                      <Text className="text-xs text-gray-500 mt-1">
                                                         Qty {row.quantity} · ${row.unitPrice.toFixed(2)} each
                                                      </Text>
                                                   </View>
                                                </View>
                                                <View className="mt-3 flex-row items-center justify-between border-t border-gray-100 pt-2">
                                                   <Text className="text-xs font-semibold text-gray-500">Line total</Text>
                                                   <Text className="text-sm font-bold text-gray-900">
                                                      ${row.lineTotal.toFixed(2)}
                                                   </Text>
                                                </View>
                                             </View>
                                          ))
                                       )}
                                    </View>
                                 </View>
                              ))}
                           </View>
                        )}
                     </ScrollView>

                     <View className="px-6 py-4 border-t border-gray-100 bg-emerald-50 flex-row items-center justify-between">
                        <Text className="text-sm font-semibold text-gray-800">Optimized total</Text>
                        <Text className="text-xl font-bold text-primary_green">
                           ${multiStore.totalCost.toFixed(2)}
                        </Text>
                     </View>
                  </View>
               </Pressable>
            </Pressable>
         </Modal>
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
   variant: "neutral" | "neutralGreenValue" | "highlight" | "highlightBold" | "gold" | "goldBold" | "danger";
   noMargin?: boolean;
}) {
   const container =
      variant === "highlight" || variant === "highlightBold"
         ? "bg-emerald-50 border-emerald-100"
         : variant === "gold" || variant === "goldBold"
            ? "bg-amber-50 border-amber-100"
         : variant === "danger"
            ? "bg-red-50 border-red-100"
         : "bg-white border-gray-200";

   const valueColor =
      variant === "highlight" || variant === "highlightBold" || variant === "neutralGreenValue"
         ? "text-primary_green"
         : variant === "gold" || variant === "goldBold"
            ? "text-amber-700"
         : variant === "danger"
            ? "text-red-500"
         : "text-gray-900";

   const valueSize = variant === "highlightBold" || variant === "goldBold" ? "text-xl" : "text-lg";

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
