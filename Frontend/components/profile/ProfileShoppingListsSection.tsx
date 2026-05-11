import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useShoppingLists } from "../../app/(tabs)/ShoppingListsContext";
import ShoppingListCard from "../my-lists/ShoppingListCard";

export default function ProfileShoppingListsSection() {
   const router = useRouter();
   const { lists, activeListId, setActiveList } = useShoppingLists();

   const preview = lists.slice(0, 3);

   return (
      <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-6 shadow-sm">
         <View className="mb-5 flex-row items-start justify-between gap-3">
            <View className="flex-1">
               <Text className="text-xl font-bold text-gray-900 mb-2">My Shopping Lists</Text>
               <Text className="text-sm text-gray-600">
                  Manage your saved shopping lists
               </Text>
            </View>
            <Pressable
               onPress={() => router.push("/(tabs)/my-lists")}
               className="flex-row items-center gap-2 px-3 py-2 rounded-xl border border-primary_green/30 bg-primary_green/5"
            >
               <Text className="text-sm font-semibold text-primary_green">My Lists</Text>
               <FontAwesome6 name="arrow-right" size={12} color="#059669" />
            </Pressable>
         </View>

         {preview.length === 0 ? (
            <Text className="text-sm text-gray-500">No lists yet. Open My Lists to create one.</Text>
         ) : (
            <View className="gap-3">
               {preview.map((list) => (
                  <ShoppingListCard
                     key={list.id}
                     list={list}
                     variant="compact"
                     isActive={list.id === activeListId}
                     onSetActive={() => setActiveList(list.id)}
                     onPressCard={() => router.push("/(tabs)/my-lists")}
                     hideManageActions
                  />
               ))}
            </View>
         )}
      </View>
   );
}
