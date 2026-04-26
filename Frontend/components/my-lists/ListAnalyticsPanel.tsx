import React from "react";
import { View, Text, ScrollView } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import type { ShoppingList } from "../../types/ShoppingList";
import { listAnalytics } from "../../types/ShoppingList";
import { accentBar } from "./accentStyles";

type ListAnalyticsPanelProps = {
   list: ShoppingList | null;
};

export default function ListAnalyticsPanel({ list }: ListAnalyticsPanelProps) {
   if (!list) {
      return (
         <View className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
            <Text className="text-lg font-bold text-gray-900 mb-1">List insights</Text>
            <Text className="text-sm text-gray-600">
               Select a list to see savings breakdown and mix.
            </Text>
         </View>
      );
   }

   const a = listAnalytics(list);

   return (
      <View className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
         <View className="flex-row items-center gap-2 mb-4">
            <FontAwesome6 name="chart-pie" size={18} color="#059669" />
            <Text className="text-lg font-bold text-gray-900">List insights</Text>
         </View>
         <Text className="text-sm text-gray-500 mb-4" numberOfLines={2}>
            {list.name}
         </Text>

         <View className="flex-row flex-wrap gap-3 mb-6">
            <View className="flex-1 min-w-[100px] rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3">
               <Text className="text-xs text-gray-500 font-medium">Items</Text>
               <Text className="text-2xl font-bold text-gray-900">{a.itemCount}</Text>
            </View>
            <View className="flex-1 min-w-[100px] rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3">
               <Text className="text-xs text-gray-500 font-medium">Est. total</Text>
               <Text className="text-2xl font-bold text-gray-900">${a.total.toFixed(2)}</Text>
            </View>
            <View className="flex-1 min-w-[100px] rounded-2xl border border-primary_green/20 bg-primary_green/5 px-3 py-3">
               <Text className="text-xs text-primary_green font-medium">Savings</Text>
               <Text className="text-2xl font-bold text-primary_green">${a.savings.toFixed(2)}</Text>
            </View>
            <View className="flex-1 min-w-[100px] rounded-2xl border border-gray-100 bg-gray-50 px-3 py-3">
               <Text className="text-xs text-gray-500 font-medium">Off RRP</Text>
               <Text className="text-2xl font-bold text-gray-900">{a.savingsPercent.toFixed(0)}%</Text>
            </View>
         </View>

         <Text className="text-sm font-semibold text-gray-800 mb-3">Product Categories</Text>
         <ScrollView className="max-h-48" nestedScrollEnabled>
            {a.categoryMix.map((row, i) => (
               <View key={i} className="mb-3">
                  <View className="flex-row justify-between mb-1">
                     <Text className="text-xs text-gray-600 flex-1 pr-2">{row.label}</Text>
                     <Text className="text-xs font-semibold text-gray-800">{row.percent}%</Text>
                  </View>
                  <View className="h-2 rounded-full bg-gray-100 overflow-hidden">
                     <View
                        className={`h-full rounded-full ${accentBar[list.accent]}`}
                        style={{ width: `${row.percent}%` }}
                     />
                  </View>
               </View>
            ))}
         </ScrollView>
      </View>
   );
}
