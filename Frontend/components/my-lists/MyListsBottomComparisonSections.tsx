import React from "react";
import { View } from "react-native";
import BasketComparisonSection from "../compare/BasketComparisonSection";
import MultiStoreShoppingStrategySection from "../compare/MultiStoreShoppingStrategySection";
import type { ShoppingList } from "../../types/ShoppingList";

type MyListsBottomComparisonSectionsProps = {
   selectedList: ShoppingList | null;
};

export default function MyListsBottomComparisonSections({
   selectedList,
}: MyListsBottomComparisonSectionsProps) {
   return (
      <>
         <View className="mt-4">
            <BasketComparisonSection selectedList={selectedList} />
         </View>
         <View className="mt-12">
            <MultiStoreShoppingStrategySection selectedList={selectedList} />
         </View>
      </>
   );
}
