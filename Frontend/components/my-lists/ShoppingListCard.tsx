import React from "react";
import { View, Text, Pressable, Alert } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import type { ShoppingList } from "../../types/ShoppingList";
import { accentDot } from "./accentStyles";

export type ShoppingListCardVariant = "full" | "compact";

type ShoppingListCardProps = {
   list: ShoppingList;
   variant?: ShoppingListCardVariant;
   isActive?: boolean;
   isSelected?: boolean;
   onPressCard?: () => void;
   onSetActive?: () => void;
   onEdit?: () => void;
   onDelete?: () => void;
   hideManageActions?: boolean;
};

export default function ShoppingListCard({
   list,
   variant = "full",
   isActive = false,
   isSelected = false,
   onPressCard,
   onSetActive,
   onEdit,
   onDelete,
   hideManageActions = false,
}: ShoppingListCardProps) {
   const itemCount = list.items.reduce((n, i) => n + i.quantity, 0);

   const confirmDelete = () => {
      if (!onDelete) return;
      Alert.alert("Delete list", `Remove “${list.name}”? This cannot be undone.`, [
         { text: "Cancel", style: "cancel" },
         { text: "Delete", style: "destructive", onPress: onDelete },
      ]);
   };

   const ringStyle = isSelected
      ? "border-2 border-primary_green shadow-sm"
      : "border border-gray-200";

   const compact = variant === "compact";

   const Container = compact ? View : Pressable;
   const containerPressProps = compact
      ? {}
      : { onPress: onPressCard };

   return (
      <Container
         {...containerPressProps}
         className={`rounded-2xl p-4 ${compact ? "bg-gray-50" : "bg-white"} ${ringStyle} ${isSelected && !compact ? "bg-primary_green/5" : ""}`}
      >
         <View className="flex-row items-start justify-between mb-2">
            <View className="flex-row items-center gap-2 flex-1 pr-2">
               <View className={`w-2.5 h-2.5 rounded-full ${accentDot[list.accent]}`} />
               <View className="flex-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                     <Text
                        className={`${compact ? "text-base" : "text-lg"} font-bold text-gray-900`}
                        numberOfLines={1}
                     >
                        {list.name}
                     </Text>
                     {isActive ? (
                        <View className="px-2 py-0.5 rounded-md bg-primary_green/15">
                           <Text className="text-[10px] font-bold text-primary_green uppercase">
                              Active
                           </Text>
                        </View>
                     ) : null}
                  </View>
                  {!compact && list.description ? (
                     <Text className="text-xs text-gray-500 mt-1" numberOfLines={2}>
                        {list.description}
                     </Text>
                  ) : null}
                  <Text className="text-xs text-gray-500 mt-1">
                     Updated {list.updatedLabel}
                  </Text>
               </View>
            </View>

            {!hideManageActions && (onEdit || onDelete) ? (
               <View className="flex-row gap-2">
                  {onEdit ? (
                     <Pressable
                        onPress={(e) => {
                           e?.stopPropagation?.();
                           onEdit();
                        }}
                        className="w-8 h-8 items-center justify-center rounded-lg bg-white border border-gray-200"
                     >
                        <Ionicons name="create-outline" size={16} color="#6B7280" />
                     </Pressable>
                  ) : null}
                  {onDelete ? (
                     <Pressable
                        onPress={(e) => {
                           e?.stopPropagation?.();
                           confirmDelete();
                        }}
                        className="w-8 h-8 items-center justify-center rounded-lg bg-white border border-gray-200"
                     >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                     </Pressable>
                  ) : null}
               </View>
            ) : null}
         </View>

         <View
            className={`flex-row items-center flex-wrap gap-x-4 gap-y-1 ${compact ? "mb-2" : "mb-3"}`}
         >
            <View className="flex-row items-center gap-1">
               <Ionicons name="cube-outline" size={16} color="#6B7280" />
               <Text className="text-sm text-gray-700">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
               </Text>
            </View>
            <View className="flex-row items-center gap-1">
               <FontAwesome6 name="dollar-sign" size={14} color="#6B7280" />
               <Text className="text-sm font-semibold text-gray-900">
                  ${list.total.toFixed(2)} total
               </Text>
            </View>
            <View className="flex-row items-center gap-1">
               <Ionicons name="trending-down" size={16} color="#10B981" />
               <Text className="text-sm font-semibold text-primary_green">
                  Save ${list.savings.toFixed(2)}
               </Text>
            </View>
         </View>

         {compact ? (
            <View className="flex-row flex-wrap gap-2 mt-1">
               {onSetActive && !isActive ? (
                  <Pressable
                     onPress={onSetActive}
                     className="px-3 py-2 rounded-xl bg-white border border-gray-300"
                  >
                     <Text className="text-xs font-semibold text-gray-700">Set active</Text>
                  </Pressable>
               ) : null}
               {onPressCard ? (
                  <Pressable
                     onPress={onPressCard}
                     className="px-3 py-2 rounded-xl bg-primary_green"
                  >
                     <Text className="text-xs font-semibold text-white">Open in My Lists</Text>
                  </Pressable>
               ) : null}
            </View>
         ) : null}

         {/* {!compact && (
            <>
               <View className="flex-row gap-2 mb-3 flex-wrap">
                  {list.items.slice(0, 6).map((item) => (
                     <View
                        key={item.id}
                        className="w-10 h-10 bg-white rounded-lg border border-gray-200 items-center justify-center px-0.5"
                     >
                        <Text className="text-[9px] text-gray-600 text-center" numberOfLines={2}>
                           {item.name}
                        </Text>
                     </View>
                  ))}
                  {list.items.length === 0 ? (
                     <Text className="text-xs text-gray-400 py-2">No items yet</Text>
                  ) : null}
               </View>

               <View className="flex-row gap-2 flex-wrap">
                  {onSetActive && !isActive ? (
                     <Pressable
                        onPress={(e) => {
                           e?.stopPropagation?.();
                           onSetActive();
                        }}
                        className="flex-1 min-w-[120px] bg-white border border-gray-300 rounded-xl py-2.5 items-center"
                     >
                        <Text className="text-sm font-semibold text-gray-700">Set active</Text>
                     </Pressable>
                  ) : null}
                  <Pressable
                     onPress={onPressCard}
                     className={`flex-1 min-w-[120px] bg-primary_green rounded-xl py-2.5 items-center ${!onSetActive || isActive ? "flex-[2]" : ""}`}
                  >
                     <Text className="text-sm font-semibold text-white">
                        {isSelected ? "Insights" : "View list"}
                     </Text>
                  </Pressable>
               </View>
            </>
         )} */}
      </Container>
   );
}
