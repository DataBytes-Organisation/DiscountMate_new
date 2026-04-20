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
         {useSingleColumn ? (
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
