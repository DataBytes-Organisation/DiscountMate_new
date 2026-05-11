import React from "react";
import { View, Text } from "react-native";
import ShoppingListCard from "./ShoppingListCard";
import type { ShoppingList } from "../../types/ShoppingList";
import type { ShoppingListCardVariant } from "./ShoppingListCard";

type MyListsListsSectionProps = {
   lists: ShoppingList[];
   masonryColumns: ShoppingList[][];
   listColumnCount: number;
   activeListId: string | null;
   effectiveSelectedId: string | null;
   wide: boolean;
   show: boolean;
   forceSingleColumn?: boolean;
   containerClassName?: string;
   cardVariant?: ShoppingListCardVariant;
   hideManageActions?: boolean;
   isLoading?: boolean;
   onSelectList: (id: string) => void;
   onSetActiveList: (id: string) => void;
   onEditList: (list: ShoppingList) => void;
   onDeleteList: (id: string) => void;
};

export default function MyListsListsSection({
   lists,
   masonryColumns,
   listColumnCount,
   activeListId,
   effectiveSelectedId,
   wide,
   show,
   forceSingleColumn = false,
   containerClassName,
   cardVariant = "full",
   hideManageActions = false,
   isLoading = false,
   onSelectList,
   onSetActiveList,
   onEditList,
   onDeleteList,
}: MyListsListsSectionProps) {
   if (!show) return null;
   const hasCustomContainerWidth = Boolean(containerClassName?.trim());

   const renderCard = (list: ShoppingList, index: number) => (
      <ShoppingListCard
         key={list.id}
         list={list}
         variant={cardVariant}
         isLastInList={index === lists.length - 1}
         isActive={list.id === activeListId}
         isSelected={list.id === effectiveSelectedId}
         onPressCard={() => onSelectList(list.id)}
         onSetActive={() => onSetActiveList(list.id)}
         onEdit={() => onEditList(list)}
         onDelete={() => onDeleteList(list.id)}
         hideManageActions={hideManageActions}
      />
   );

   const useSingleColumn = forceSingleColumn || listColumnCount === 1;

   return (
      <View className={`${wide && !hasCustomContainerWidth ? "flex-1 min-w-0" : ""} ${containerClassName ?? ""}`}>
         <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 pl-2">
            All lists ({lists.length})
         </Text>
         {isLoading ? (
            <View className={cardVariant === "compact" ? "gap-0 -mx-4" : "gap-4"}>
               {[0, 1, 2].map((index) => (
                  <ShoppingListCardSkeleton
                     key={`shopping-list-skeleton-${index}`}
                     compact={cardVariant === "compact"}
                  />
               ))}
            </View>
         ) : useSingleColumn ? (
            <View className={cardVariant === "compact" ? "gap-0 -mx-4" : "gap-4"}>
               {lists.map((list, index) => renderCard(list, index))}
            </View>
         ) : (
            <View className="flex-row items-start gap-4">
               {masonryColumns.map((column, columnIndex) => (
                  <View key={`column-${columnIndex}`} className="flex-1 gap-4">
                     {column.map((list, index) => renderCard(list, index))}
                  </View>
               ))}
            </View>
         )}
      </View>
   );
}

function ShoppingListCardSkeleton({ compact }: { compact: boolean }) {
   return (
      <View
         className={
            compact
               ? "py-3 pr-4 pl-6 border-t border-gray-200 bg-white"
               : "rounded-2xl p-4 bg-white border border-gray-200"
         }
      >
         <View className="flex-row items-center gap-2 mb-3">
            <View className="w-2.5 h-2.5 rounded-full bg-gray-200" />
            <View className="h-4 rounded-full bg-gray-200 w-3/5" />
         </View>
         {!compact ? (
            <>
               <View className="h-3 rounded-full bg-gray-100 w-4/5 mb-3" />
               <View className="flex-row gap-2 mb-3">
                  <View className="h-7 rounded-xl bg-gray-100 flex-1" />
                  <View className="h-7 rounded-xl bg-gray-100 flex-1" />
               </View>
            </>
         ) : null}
         <View className="h-3 rounded-full bg-gray-100 w-1/2" />
      </View>
   );
}
