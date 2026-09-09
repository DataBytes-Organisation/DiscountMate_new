import React, { useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useShoppingLists } from "./ShoppingListsContext";
import { ActionButton, Card } from "../../features/comparison/ComparisonPrimitives";
import { GroceryListComparison } from "../../features/comparison/GroceryListComparison";
import { SingleProductComparison } from "../../features/comparison/SingleProductComparison";
import FooterSection from "../../components/home/FooterSection";

type ComparisonMode = "grocery" | "single";

export default function CompareScreen() {
   const [mode, setMode] = useState<ComparisonMode>("single");
   const router = useRouter();
   const { width } = useWindowDimensions();
   const compact = width < 700;
   const { lists, activeListId } = useShoppingLists();
   const activeList = lists.find((list) => list.id === activeListId) || lists[0];
   const comparisonV2Enabled = process.env.EXPO_PUBLIC_COMPARISON_V2_ENABLED !== "false";

   if (!comparisonV2Enabled) {
      return (
         <View className="flex-1 items-center justify-center bg-gray-50 p-8">
            <Text className="text-lg font-bold text-gray-900">Comparison is temporarily unavailable</Text>
            <Text className="mt-2 text-center text-sm text-gray-500">The Comparison V2 feature flag is disabled for this environment.</Text>
         </View>
      );
   }

   return (
      <View className="flex-1 bg-[#F7F8FA]">
         <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 0 }}>
            <View className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-7 md:py-10">
               <View className="items-center">
                  <Text className={`${compact ? "text-2xl" : "text-3xl"} font-bold tracking-tight text-gray-900`}>Product Comparison</Text>
                  <Text className="mt-2 text-center text-sm text-gray-500">Compare products across retailers to find the best value</Text>
               </View>

               <Card className={`${compact ? "gap-4" : "flex-row items-center justify-between"} mt-8 px-5 py-4`}>
                  <Text className="text-base font-bold text-gray-900">Compare Products</Text>
                  <View className="flex-row flex-wrap gap-2">
                     <ActionButton label="View Power BI Report" icon="chart-column" onPress={() => router.push("/(tabs)/compare-powerbi")} compact />
                     <ActionButton label="Compare a product" icon="plus" primary={mode === "single"} onPress={() => setMode("single")} compact />
                  </View>
               </Card>

               <View className="mt-4 self-start flex-row rounded-xl bg-gray-100 p-1">
                  <TabButton label="Single Product" active={mode === "single"} onPress={() => setMode("single")} />
                  <TabButton label="Grocery List" count={activeList?.items.length || 0} active={mode === "grocery"} onPress={() => setMode("grocery")} />
               </View>

               <View className="mt-5">
                  {mode === "grocery" ? <GroceryListComparison /> : <SingleProductComparison />}
               </View>
            </View>
            <FooterSection disableEdgeOffset />
         </ScrollView>
      </View>
   );
}

function TabButton({ label, count, active, onPress }: { label: string; count?: number; active: boolean; onPress: () => void }) {
   return (
      <Pressable
         accessibilityRole="tab"
         accessibilityLabel={label}
         accessibilityState={{ selected: active }}
         onPress={onPress}
         className={`flex-row items-center gap-2 rounded-lg px-4 py-2.5 ${active ? "bg-white shadow-sm" : ""}`}
      >
         <Text className={`text-sm ${active ? "font-semibold text-gray-900" : "text-gray-500"}`}>{label}</Text>
         {count !== undefined ? <View className="rounded-full bg-gray-100 px-2 py-0.5"><Text className="text-[10px] text-gray-600">{count}</Text></View> : null}
      </Pressable>
   );
}
