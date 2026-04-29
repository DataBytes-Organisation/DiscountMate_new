import React, { useMemo, useState } from "react";
import { View, Text, Pressable, Alert, Platform, Image, Modal } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import Ionicons from "react-native-vector-icons/Ionicons";
import { listAnalytics, type ShoppingList, type ShoppingListLineItem } from "../../types/ShoppingList";
import { accentBar, accentDot } from "./accentStyles";

type Props = {
   list: ShoppingList | null;
   isActive: boolean;
   onEdit: () => void;
   onDelete: () => void;
   onSetActive: () => void;
};

export default function MyListsSelectedListDetailsSection({
   list,
   isActive,
   onEdit,
   onDelete,
   onSetActive,
}: Props) {
   const [previewItem, setPreviewItem] = useState<ShoppingListLineItem | null>(null);

   const itemCount = useMemo(
      () => (list ? list.items.reduce((total, item) => total + item.quantity, 0) : 0),
      [list]
   );

   const categoryRows = useMemo(() => {
      if (!list) return [];
      return listAnalytics(list).categoryMix;
   }, [list]);
   const retailStores = useMemo(() => {
      if (!list || list.items.length === 0) return [];

      const stores = new Set<string>();
      list.items.forEach((item) => {
         if (item.store?.trim()) stores.add(item.store.trim());
         if (typeof item.retailerPrices?.coles === "number") stores.add("Coles");
         if (typeof item.retailerPrices?.woolworths === "number") stores.add("Woolworths");
         if (typeof item.retailerPrices?.iga === "number") stores.add("IGA");
      });

      return Array.from(stores).sort((a, b) => a.localeCompare(b));
   }, [list]);
   const previewRetailers = useMemo(() => {
      if (!previewItem) return null;

      const retailerRows: Array<{
         key: "coles" | "woolworths" | "iga";
         name: string;
         price: number | null;
      }> = [
         {
            key: "coles",
            name: "Coles",
            price:
               typeof previewItem.retailerPrices?.coles === "number" ? previewItem.retailerPrices.coles : null,
         },
         {
            key: "woolworths",
            name: "Woolworths",
            price:
               typeof previewItem.retailerPrices?.woolworths === "number"
                  ? previewItem.retailerPrices.woolworths
                  : null,
         },
         {
            key: "iga",
            name: "IGA",
            price: typeof previewItem.retailerPrices?.iga === "number" ? previewItem.retailerPrices.iga : null,
         },
      ];

      const availablePrices = retailerRows
         .map((row) => row.price)
         .filter((price): price is number => typeof price === "number" && price > 0);
      const lowestPrice = availablePrices.length > 0 ? Math.min(...availablePrices) : null;

      return retailerRows.map((row) => ({
         ...row,
         isCheapest: lowestPrice != null && row.price === lowestPrice,
      }));
   }, [previewItem]);
   const savingsSummary = useMemo(() => {
      if (!list) return null;

      const optimalTotal = list.items.reduce((total, item) => {
         const retailerPrices = item.retailerPrices
            ? Object.values(item.retailerPrices).filter(
                 (price): price is number => typeof price === "number" && price > 0
              )
            : [];

         if (retailerPrices.length === 0) {
            return total + item.price * item.quantity;
         }

         return total + Math.min(...retailerPrices) * item.quantity;
      }, 0);
      const highestAvailableTotal = list.items.reduce((total, item) => {
         const retailerPrices = item.retailerPrices
            ? Object.values(item.retailerPrices).filter(
                 (price): price is number => typeof price === "number" && price > 0
              )
            : [];

         if (retailerPrices.length === 0) {
            return total + item.price * item.quantity;
         }

         return total + Math.max(...retailerPrices) * item.quantity;
      }, 0);
      const currentTotal = list.items.reduce(
         (total, item) => total + item.price * item.quantity,
         0
      );

      const priceOptimizationDelta = currentTotal - optimalTotal;
      const isExtraCost = priceOptimizationDelta > 0.005;
      const savingsFromBestPrices = isExtraCost
         ? 0
         : Math.max(0, highestAvailableTotal - currentTotal);
      const extraCostFromBestPrices = Math.max(0, priceOptimizationDelta);
      const savedListSavings = Math.max(0, list.savings);
      const savingsFromDiscounts = Math.max(0, savedListSavings - savingsFromBestPrices);
      const totalSavings = isExtraCost
         ? extraCostFromBestPrices
         : savingsFromBestPrices + savingsFromDiscounts;

      return {
         isExtraCost,
         totalSavings,
         savingsFromDiscounts,
         savingsFromBestPrices,
         extraCostFromBestPrices,
      };
   }, [list]);

   if (!list) {
      return (
         <View className="bg-white rounded-3xl border border-gray-200 px-6 py-8 shadow-sm mt-8 mb-2">
            <Text className="text-lg font-bold text-gray-900 mb-1">List Details</Text>
            <Text className="text-sm text-gray-600">Select a list from the sidebar to view details.</Text>
         </View>
      );
   }

   const confirmDelete = () => {
      if (Platform.OS === "web") {
         if (typeof window !== "undefined" && window.confirm(`Remove "${list.name}"? This cannot be undone.`)) {
            onDelete();
         }
         return;
      }

      Alert.alert("Delete list", `Remove “${list.name}”? This cannot be undone.`, [
         { text: "Cancel", style: "cancel" },
         { text: "Delete", style: "destructive", onPress: onDelete },
      ]);
   };

   return (
      <>
         <View className="bg-white rounded-3xl border border-gray-200 px-6 py-8 shadow-sm mt-8 mb-2">
         <View className="flex-row items-start justify-between mb-5 gap-4">
            <View className="flex-row items-center gap-2 flex-1">
               <View className={`w-3 h-3 rounded-full ${accentDot[list.accent]}`} />
               <Text className="text-2xl font-bold text-gray-900" numberOfLines={1}>
                  {list.name}
               </Text>
               {isActive ? (
                  <View
                     className="px-2.5 py-1 rounded-lg border border-amber-500 bg-amber-300/90 shadow-sm"
                     style={{ shadowColor: "#D97706", shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 1 } }}
                  >
                     <Text className="text-xs font-extrabold text-amber-950 uppercase tracking-wide">
                        Active
                     </Text>
                  </View>
               ) : null}
            </View>

            <View className="flex-row items-center gap-2">
               {!isActive ? (
                  <Pressable
                     onPress={onSetActive}
                     className="px-3 py-2 rounded-xl border border-amber-300 bg-amber-50"
                  >
                     <Text className="text-sm font-semibold text-amber-700">Set Active</Text>
                  </Pressable>
               ) : null}
               <Pressable
                  onPress={onEdit}
                  className="flex-row items-center gap-2 px-3 py-2 rounded-xl border border-sky-300 bg-sky-50"
               >
                  <Ionicons name="create-outline" size={18} color="#0369A1" />
                  <Text className="text-sm font-semibold text-sky-700">Edit</Text>
               </Pressable>
               <Pressable
                  onPress={confirmDelete}
                  className="flex-row items-center gap-2 px-3 py-2 rounded-xl border border-red-300 bg-red-50"
               >
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  <Text className="text-sm font-semibold text-red-600">Delete</Text>
               </Pressable>
            </View>
         </View>

         <View className="flex-row items-start gap-10">
            <View className="flex-1 min-w-0">
               <Text className="text-sm text-gray-600 mb-5">
                  {list.description.trim() || "No description provided."}
               </Text>

               <View className="flex-row flex-wrap gap-3 mb-4">
                  <PrimaryMetricCard label="No. of items" value={`${itemCount}`} icon="cube-outline" />
                  <PrimaryMetricCard label="Total" value={`$${list.total.toFixed(2)}`} icon="dollar-sign" isFA />
                  <PrimaryMetricCard
                     label={savingsSummary?.isExtraCost ? "Extra cost" : "Est. savings"}
                     value={`${savingsSummary?.isExtraCost ? "+" : ""}$${savingsSummary?.totalSavings.toFixed(2) ?? "0.00"}`}
                     icon="trending-down-outline"
                     tone={savingsSummary?.isExtraCost ? "danger" : "success"}
                  />
               </View>

               {retailStores.length > 0 ? (
                  <View className="mb-4">
                     <Text className="text-xs text-gray-500 font-semibold uppercase mb-2">
                        Retail stores in this list
                     </Text>
                     <View className="flex-row flex-wrap gap-2">
                        {retailStores.map((store) => (
                           <StorePill key={store} label={store} />
                        ))}
                     </View>
                  </View>
               ) : null}

               <View className="mb-4">
                  <Text className="text-xs text-gray-500 font-semibold uppercase mb-2">
                     Items in this list
                  </Text>
                  {list.items.length === 0 ? (
                     <Text className="text-sm text-gray-500">No items yet.</Text>
                  ) : (
                     <View className="gap-2">
                        {list.items.slice(0, 6).map((item) => (
                           <Pressable
                              key={item.id}
                              onPress={() => setPreviewItem(item)}
                              className="flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2"
                           >
                              <View className="flex-row items-center gap-3 flex-1 min-w-0">
                                 <View className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 items-center justify-center">
                                    {item.image ? (
                                       <Image
                                          source={{ uri: item.image }}
                                          style={{ width: "100%", height: "100%" }}
                                          resizeMode="cover"
                                       />
                                    ) : (
                                       <FontAwesome6 name="bag-shopping" size={14} color="#9CA3AF" />
                                    )}
                                 </View>
                                 <View className="flex-1 min-w-0">
                                    <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                                       {item.name}
                                    </Text>
                                    <Text className="text-xs text-gray-500">
                                       {item.store ? `${item.store} • ` : ""}${item.price.toFixed(2)} each
                                    </Text>
                                 </View>
                              </View>
                              <Text className="text-sm font-semibold text-gray-700">x{item.quantity}</Text>
                           </Pressable>
                        ))}
                        {list.items.length > 6 ? (
                           <Text className="text-xs text-gray-500">
                              +{list.items.length - 6} more items
                           </Text>
                        ) : null}
                     </View>
                  )}
               </View>

               <View className="pt-3 border-t border-gray-100">
                  <View className="flex-row items-center">
                     <Text className="text-xs text-gray-500">Created {list.createdLabel}</Text>
                     <View className="w-px h-3 bg-gray-300 mx-3" />
                     <Text className="text-xs text-gray-500">Last updated {list.updatedLabel}</Text>
                  </View>
               </View>
            </View>

            <View className="w-[320px]">
               <Text className="text-xl font-bold text-gray-900 mb-3">Product Categories</Text>
               {categoryRows.length === 0 ? (
                  <Text className="text-sm text-gray-500">No items yet.</Text>
               ) : (
                  <View className="gap-3">
                     {categoryRows.map((row) => (
                        <View key={row.label}>
                           <View className="flex-row items-center justify-between mb-1">
                              <Text className="text-4 text-gray-600">{row.label}</Text>
                              <Text className="text-4 font-semibold text-gray-800">{row.percent}%</Text>
                           </View>
                           <View className="h-3 rounded-full bg-gray-200/70 overflow-hidden">
                              <View
                                 className={`h-full rounded-full ${accentBar[list.accent]}`}
                                 style={{ width: `${Math.max(row.percent, 8)}%` }}
                              />
                           </View>
                        </View>
                     ))}
                  </View>
               )}

               <View className={`mt-6 rounded-2xl bg-gradient-to-b ${
                  savingsSummary?.isExtraCost ? "from-red-50/70" : "from-emerald-50/70"
               } to-white p-4 shadow-sm`}>
                  <Text className="text-xl font-bold text-gray-900 mb-4">
                     {savingsSummary?.isExtraCost ? "Cost Summary" : "Savings Summary"}
                  </Text>

                  <View className="flex-row items-center justify-between mb-3">
                     <Text className="text-base font-semibold text-gray-900">
                        {savingsSummary?.isExtraCost ? "Extra cost" : "Total savings"}
                     </Text>
                     <Text className={`text-3xl font-bold ${
                        savingsSummary?.isExtraCost ? "text-red-500" : "text-primary_green"
                     }`}>
                        {savingsSummary?.isExtraCost ? "+" : ""}${savingsSummary?.totalSavings.toFixed(2) ?? "0.00"}
                     </Text>
                  </View>

                  <View className="bg-white/80 rounded-xl px-3 py-3">
                     <Text className="text-xs font-semibold text-gray-500 uppercase mb-2 tracking-wide">
                        Savings breakdown
                     </Text>
                     <View className="flex-row items-center justify-between mb-1.5">
                        <Text className="text-sm text-gray-600">Discount offers</Text>
                        <Text className="text-sm font-semibold text-gray-800">
                           ${savingsSummary?.savingsFromDiscounts.toFixed(2) ?? "0.00"}
                        </Text>
                     </View>
                     <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-gray-600">
                           {savingsSummary?.isExtraCost ? "Extra cost vs best retailer" : "Best retailer price"}
                        </Text>
                        <Text className={`text-sm font-semibold ${
                           savingsSummary?.isExtraCost ? "text-red-500" : "text-gray-800"
                        }`}>
                           {savingsSummary?.isExtraCost ? "+" : ""}${(
                              savingsSummary?.isExtraCost
                                 ? savingsSummary.extraCostFromBestPrices
                                 : savingsSummary?.savingsFromBestPrices ?? 0
                           ).toFixed(2)}
                        </Text>
                     </View>
                  </View>
               </View>
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
                  onPress={(e) => e.stopPropagation()}
               >
                  <View className="mb-3 flex-row justify-end">
                     <Pressable
                        onPress={() => setPreviewItem(null)}
                        className="w-9 h-9 rounded-full bg-white/95 border border-gray-200 items-center justify-center"
                     >
                        <Ionicons name="close" size={20} color="#111827" />
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
                                 <FontAwesome6 name="bag-shopping" size={18} color="#9CA3AF" />
                              )}
                           </View>
                           <View className="flex-1 min-w-0">
                              <Text className="text-xl font-bold text-gray-900" numberOfLines={2}>
                                 {previewItem.name}
                              </Text>
                              <Text className="text-sm text-gray-500 mt-1">
                                 {previewItem.store ? `Selected retailer: ${previewItem.store}` : "No retailer selected"}
                              </Text>
                              <Text className="text-sm text-gray-500">
                                 Quantity: {previewItem.quantity}
                              </Text>
                           </View>
                        </View>

                        <View className="mt-4 border-t border-gray-100 pt-3">
                           <Text className="text-xs font-semibold uppercase text-gray-500 mb-2">Retailer prices</Text>
                           <View className="flex-row gap-2">
                              {previewRetailers?.map((retailer) => (
                                 <View
                                    key={retailer.key}
                                    className={`flex-1 rounded-lg px-3 py-2 border ${
                                       retailer.isCheapest
                                          ? "border-amber-300 bg-amber-50"
                                          : "border-gray-200 bg-gray-50"
                                    }`}
                                 >
                                    <Text className="text-xs text-gray-500">{retailer.name}</Text>
                                    <Text
                                       className={`text-base font-bold ${
                                          retailer.isCheapest ? "text-amber-700" : "text-gray-900"
                                       }`}
                                    >
                                       {typeof retailer.price === "number" ? `$${retailer.price.toFixed(2)}` : "-"}
                                    </Text>
                                 </View>
                              ))}
                           </View>
                        </View>
                     </View>
                  ) : null}
               </Pressable>
            </Pressable>
         </Modal>
      </>
   );
}

function PrimaryMetricCard({
   label,
   value,
   icon,
   isFA = false,
   tone = "success",
}: {
   label: string;
   value: string;
   icon: string;
   isFA?: boolean;
   tone?: "success" | "danger";
}) {
   const iconColor = tone === "danger" ? "#EF4444" : "#059669";
   const containerClass =
      tone === "danger"
         ? "border-red-200 bg-red-50"
         : "border-primary_green/20 bg-primary_green/5";
   const valueClass = tone === "danger" ? "text-red-500" : "text-gray-900";

   return (
      <View className={`min-w-[170px] flex-1 rounded-2xl border ${containerClass} px-4 py-3`}>
         <View className="flex-row items-center gap-2 mb-1">
            {isFA ? (
               <FontAwesome6 name={icon as any} size={12} color={iconColor} />
            ) : (
               <Ionicons name={icon as any} size={14} color={iconColor} />
            )}
            <Text className="text-xs text-gray-600 font-semibold uppercase">{label}</Text>
         </View>
         <Text className={`text-xl font-bold ${valueClass}`}>{value}</Text>
      </View>
   );
}

function StorePill({ label }: { label: string }) {
   return (
      <View className="px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50">
         <Text className="text-xs font-semibold text-gray-700">{label}</Text>
      </View>
   );
}

function SummaryRow({
   label,
   value,
   showDivider = true,
}: {
   label: string;
   value: string;
   showDivider?: boolean;
}) {
   return (
      <View
         className={`flex-row items-center justify-between py-2.5 ${showDivider ? "border-b border-gray-100" : ""}`}
      >
         <Text className="text-sm text-gray-700">{label}</Text>
         <Text className="text-sm font-semibold text-gray-900">{value}</Text>
      </View>
   );
}
