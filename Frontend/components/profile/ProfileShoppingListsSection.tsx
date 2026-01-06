import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export default function ProfileShoppingListsSection() {
   // Mock data - replace with actual shopping lists
   const shoppingLists = [
      {
         name: "Weekly Essentials",
         updated: "2 days ago",
         itemCount: 10,
         total: 90.0,
         savings: 8.9,
      },
      {
         name: "Monthly Stock-up",
         updated: "1 week ago",
         itemCount: 8,
         total: 150.0,
         savings: 17.2,
      },
      {
         name: "Healthy Snacks",
         updated: "2 days ago",
         itemCount: 6,
         total: 50.0,
         savings: 6.9,
      },
   ];

   return (
      <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-6 shadow-sm">
         <View className="mb-5">
            <Text className="text-xl font-bold text-gray-900 mb-2">
               My Shopping Lists
            </Text>
            <Text className="text-sm text-gray-600">
               Manage your saved shopping lists
            </Text>
         </View>

         <View className="gap-4">
            {shoppingLists.map((list, index) => (
               <View
                  key={index}
                  className="border border-gray-200 rounded-2xl p-4 bg-gray-50"
               >
                  <View className="flex-row items-start justify-between mb-3">
                     <View className="flex-1">
                        <Text className="text-lg font-bold text-gray-900 mb-1">
                           {list.name}
                        </Text>
                        <Text className="text-xs text-gray-500">
                           Updated {list.updated}
                        </Text>
                     </View>
                     <View className="flex-row gap-2">
                        <Pressable className="w-8 h-8 items-center justify-center rounded-lg bg-white border border-gray-200">
                           <Ionicons name="create-outline" size={16} color="#6B7280" />
                        </Pressable>
                        <Pressable className="w-8 h-8 items-center justify-center rounded-lg bg-white border border-gray-200">
                           <Ionicons name="share-outline" size={16} color="#6B7280" />
                        </Pressable>
                        <Pressable className="w-8 h-8 items-center justify-center rounded-lg bg-white border border-gray-200">
                           <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </Pressable>
                     </View>
                  </View>

                  <View className="flex-row items-center gap-4 mb-3">
                     <View className="flex-row items-center gap-1">
                        <Ionicons name="cube-outline" size={16} color="#6B7280" />
                        <Text className="text-sm text-gray-700">
                           {list.itemCount} items
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

                  {/* Product preview grid */}
                  <View className="flex-row gap-2 mb-3">
                     {[...Array(Math.min(list.itemCount, 6))].map((_, i) => (
                        <View
                           key={i}
                           className="w-10 h-10 bg-white rounded-lg border border-gray-200 items-center justify-center"
                        >
                           <FontAwesome6 name="tag" size={14} color="#9CA3AF" />
                        </View>
                     ))}
                  </View>

                  <View className="flex-row gap-2">
                     <Pressable className="flex-1 bg-white border border-gray-300 rounded-xl py-2.5 items-center">
                        <Text className="text-sm font-semibold text-gray-700">
                           + Add More
                        </Text>
                     </Pressable>
                     <Pressable className="flex-1 bg-primary_green rounded-xl py-2.5 items-center">
                        <Text className="text-sm font-semibold text-white">
                           View & Shop List
                        </Text>
                     </Pressable>
                  </View>
               </View>
            ))}
         </View>
      </View>
   );
}
