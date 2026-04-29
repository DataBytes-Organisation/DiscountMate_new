import React, { useState } from "react";
import { View, Text, Pressable, Image, ScrollView } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useRouter } from "expo-router";
import { useShoppingLists } from "../../app/(tabs)/ShoppingListsContext";
import type { ShoppingList } from "../../types/ShoppingList";
import { accentDot, accentRing } from "../my-lists/accentStyles";
import EditShoppingListModal from "../my-lists/EditShoppingListModal";

const accentText: Record<ShoppingList["accent"], string> = {
   emerald: "text-emerald-600",
   amber: "text-amber-600",
   sky: "text-sky-600",
   violet: "text-violet-600",
   rose: "text-rose-600",
};

const accentButton: Record<ShoppingList["accent"], string> = {
   emerald: "from-emerald-500 to-emerald-600",
   amber: "from-amber-500 to-amber-600",
   sky: "from-sky-500 to-sky-600",
   violet: "from-violet-500 to-violet-600",
   rose: "from-rose-500 to-rose-600",
};

const accentSoftBg: Record<ShoppingList["accent"], string> = {
   emerald: "from-emerald-50 to-emerald-100",
   amber: "from-amber-50 to-amber-100",
   sky: "from-sky-50 to-sky-100",
   violet: "from-violet-50 to-violet-100",
   rose: "from-rose-50 to-rose-100",
};

export default function SmartListsSection() {
   const router = useRouter();
   const { lists, isLoading, createList } = useShoppingLists();
   const [createModalOpen, setCreateModalOpen] = useState(false);

   const openCreateList = () => {
      setCreateModalOpen(true);
   };

   const openList = (listId: string) => {
      router.push({
         pathname: "/(tabs)/my-lists",
         params: { listId },
      });
   };

   const handleCreateList = async (payload: {
      name: string;
      description: string;
      accent: ShoppingList["accent"];
   }) => {
      try {
         await createList(payload);
      } catch (error) {
         console.error("Failed to create shopping list from homepage:", error);
      }
   };

   return (
      <View className="bg-white border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
            {/* Header */}
            <View className="mb-10">
               <Text className="text-3xl font-bold text-[#111827] mb-2">
                  Smart Shopping Lists
               </Text>
               <Text className="text-gray-600">
                  Create and manage your shopping lists for better savings
               </Text>
            </View>

            {/* Cards */}
            <ScrollView
               horizontal
               showsHorizontalScrollIndicator={false}
               contentContainerStyle={{ paddingRight: 24, paddingTop: 20, paddingBottom: 28 }}
            >
               {/* Create new list card */}
               <Pressable className="w-[360px] mr-6" onPress={openCreateList}>
                  <View className="bg-gradient-to-br from-light to-white border-2 border-dashed border-gray-300 rounded-2xl p-6 h-full items-center justify-center text-center hover:border-primary_green hover:bg-secondary_green transition-all">
                     <View className="w-14 h-14 bg-gradient-to-br from-green-50 to-green-100 rounded-full flex items-center justify-center mb-4">
                        <FontAwesome6 name="plus" size={24} className="text-primary" />
                     </View>
                     <Text className="text-lg font-bold text-[#111827] mb-1">
                        Create New List
                     </Text>
                     <Text className="text-sm text-gray-600">
                        Start building your custom shopping list
                     </Text>
                  </View>
               </Pressable>

               {isLoading && lists.length === 0 ? (
                  <>
                     <SmartListSkeleton />
                     <SmartListSkeleton />
                  </>
               ) : lists.length > 0 ? (
                  lists.map((list) => (
                     <SmartListCard key={list.id} list={list} onPress={() => openList(list.id)} />
                  ))
               ) : (
                  <View className="w-[720px]">
                     <View className="bg-white border border-gray-200 rounded-2xl p-6 h-full items-center justify-center">
                        <Text className="text-base font-semibold text-gray-900">No lists yet</Text>
                        <Text className="text-sm text-gray-500 mt-1">
                           Create your first shopping list to see it here.
                        </Text>
                     </View>
                  </View>
               )}
            </ScrollView>

            <EditShoppingListModal
               visible={createModalOpen}
               onClose={() => setCreateModalOpen(false)}
               editingList={null}
               onSave={handleCreateList}
            />
         </View>
      </View>
   );
}

function SmartListCard({ list, onPress }: { list: ShoppingList; onPress: () => void }) {
   const itemCount = list.items.reduce((sum, item) => sum + item.quantity, 0);
   const thumbnails = list.items.filter((item) => item.image).slice(0, 3);
   const remainingCount = Math.max(0, list.items.length - thumbnails.length);
   const totalSavings = calculateListSavings(list);

   return (
      <Pressable className="w-[360px] mr-6" onPress={onPress}>
         <View className={`border rounded-2xl p-6 hover:shadow-xl transition-all ${accentRing[list.accent]}`}>
            <View className="flex-row items-center justify-between mb-4">
               <View className="flex-row items-center gap-2 flex-1 pr-2">
                  <View className={`w-2.5 h-2.5 rounded-full ${accentDot[list.accent]}`} />
                  <Text className="text-lg font-bold text-[#111827] flex-1" numberOfLines={1}>
                     {list.name}
                  </Text>
               </View>
               <FontAwesome6 name="ellipsis-vertical" size={16} className={`${accentText[list.accent]} opacity-70`} />
            </View>

            <View className="space-y-3 mb-5">
               <View className="flex-row items-center justify-between text-sm">
                  <Text className="text-gray-600 font-medium">
                     {itemCount} {itemCount === 1 ? "item" : "items"}
                  </Text>
                  <Text className={`${accentText[list.accent]} font-bold`}>
                     Save ${totalSavings.toFixed(2)}
                  </Text>
               </View>

               <View className="flex-row items-center gap-2">
                  <View className="flex-row -space-x-2">
                     {thumbnails.length > 0 ? (
                        thumbnails.map((item) => (
                           <View
                              key={`${list.id}-${item.id}`}
                              className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shadow-sm border border-white"
                           >
                              <Image
                                 source={{ uri: item.image }}
                                 style={{ width: "100%", height: "100%" }}
                                 resizeMode="cover"
                              />
                           </View>
                        ))
                     ) : (
                        <View className={`w-10 h-10 bg-gradient-to-br ${accentSoftBg[list.accent]} rounded-lg flex items-center justify-center shadow-sm`}>
                           <FontAwesome6 name="basket-shopping" size={14} className={accentText[list.accent]} />
                        </View>
                     )}
                  </View>
                  {remainingCount > 0 ? (
                     <Text className="text-xs text-gray-500 font-medium">
                        +{remainingCount} more
                     </Text>
                  ) : null}
               </View>
            </View>

            <Pressable className={`w-full py-3 bg-gradient-to-r ${accentButton[list.accent]} rounded-xl items-center justify-center hover:shadow-lg transition-all`} onPress={onPress}>
               <Text className="text-sm font-semibold text-white">View List</Text>
            </Pressable>
         </View>
      </Pressable>
   );
}

function calculateListSavings(list: ShoppingList) {
   const currentTotal = list.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
   );
   const optimalTotal = list.items.reduce((total, item) => {
      const retailerPrices = item.retailerPrices
         ? Object.values(item.retailerPrices).filter(
              (price): price is number => typeof price === "number" && price > 0
           )
         : [];

      if (retailerPrices.length === 0) return total + item.price * item.quantity;
      return total + Math.min(...retailerPrices) * item.quantity;
   }, 0);
   const highestAvailableTotal = list.items.reduce((total, item) => {
      const retailerPrices = item.retailerPrices
         ? Object.values(item.retailerPrices).filter(
              (price): price is number => typeof price === "number" && price > 0
           )
         : [];

      if (retailerPrices.length === 0) return total + item.price * item.quantity;
      return total + Math.max(...retailerPrices) * item.quantity;
   }, 0);

   const isExtraCost = currentTotal - optimalTotal > 0.005;
   if (isExtraCost) return 0;

   const retailerSavings = Math.max(0, highestAvailableTotal - currentTotal);
   const discountSavings = Math.max(0, list.savings - retailerSavings);
   return retailerSavings + discountSavings;
}

function SmartListSkeleton() {
   return (
      <View className="w-[360px] mr-6">
         <View className="bg-white border border-gray-200 rounded-2xl p-6">
            <View className="h-5 rounded-full bg-gray-200 w-3/5 mb-5" />
            <View className="flex-row items-center justify-between mb-4">
               <View className="h-4 rounded-full bg-gray-100 w-20" />
               <View className="h-4 rounded-full bg-gray-100 w-24" />
            </View>
            <View className="flex-row gap-2 mb-5">
               {[0, 1, 2].map((index) => (
                  <View key={`smart-list-skeleton-thumb-${index}`} className="w-10 h-10 rounded-lg bg-gray-100" />
               ))}
            </View>
            <View className="h-11 rounded-xl bg-gray-100" />
         </View>
      </View>
   );
}
