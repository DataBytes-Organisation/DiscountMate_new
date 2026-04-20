import React, { useMemo } from "react";
import { View, Text, Pressable, Alert, Platform } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import Ionicons from "react-native-vector-icons/Ionicons";
import { listAnalytics, type ShoppingList } from "../../types/ShoppingList";
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
   const itemCount = useMemo(
      () => (list ? list.items.reduce((total, item) => total + item.quantity, 0) : 0),
      [list]
   );

   const categoryRows = useMemo(() => {
      if (!list) return [];
      return listAnalytics(list).categoryMix;
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
                     label="Est. savings"
                     value={`$${list.savings.toFixed(2)}`}
                     icon="trending-down-outline"
                  />
               </View>

               <View className="mb-4">
                  <Text className="text-xs text-gray-500 font-semibold uppercase mb-2">
                     Retail stores in this list
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                     <StorePill label="Aldi" />
                     <StorePill label="Coles" />
                     <StorePill label="Woolworths" />
                  </View>
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
            </View>
         </View>
      </View>
   );
}

function PrimaryMetricCard({
   label,
   value,
   icon,
   isFA = false,
}: {
   label: string;
   value: string;
   icon: string;
   isFA?: boolean;
}) {
   return (
      <View className="min-w-[170px] flex-1 rounded-2xl border border-primary_green/20 bg-primary_green/5 px-4 py-3">
         <View className="flex-row items-center gap-2 mb-1">
            {isFA ? (
               <FontAwesome6 name={icon as any} size={12} color="#059669" />
            ) : (
               <Ionicons name={icon as any} size={14} color="#059669" />
            )}
            <Text className="text-xs text-gray-600 font-semibold uppercase">{label}</Text>
         </View>
         <Text className="text-xl font-bold text-gray-900">{value}</Text>
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
