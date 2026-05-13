import React, { useState } from "react";
import { View, Text, Pressable, Switch } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export default function ProfilePreferredStoresSection() {
   // Mock data - replace with actual store preferences
   const [stores, setStores] = useState([
      {
         name: "Coles",
         location: "Sydney CBD",
         frequency: "Weekly",
         visitsThisYear: 45,
         enabled: false,
      },
      {
         name: "Woolworths",
         location: "Sydney CBD",
         frequency: "Bi-weekly",
         visitsThisYear: 23,
         enabled: true,
      },
      {
         name: "Aldi",
         location: "Sydney CBD",
         frequency: "Monthly",
         visitsThisYear: 12,
         enabled: true,
      },
   ]);

   const toggleStore = (index: number) => {
      const updatedStores = [...stores];
      updatedStores[index].enabled = !updatedStores[index].enabled;
      setStores(updatedStores);
   };

   const getStoreIcon = (storeName: string) => {
      switch (storeName.toLowerCase()) {
         case "coles":
            return "store";
         case "woolworths":
            return "shopping-bag";
         case "aldi":
            return "cart-shopping";
         default:
            return "store";
      }
   };

   return (
      <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-6 shadow-sm">
         <View className="mb-5">
            <Text className="text-xl font-bold text-gray-900 mb-2">
               Preferred Stores
            </Text>
            <Text className="text-sm text-gray-600">
               Select your preferred retailers for personalized recommendations
            </Text>
         </View>

         <View className="gap-3">
            {stores.map((store, index) => (
               <View
                  key={index}
                  className="border border-gray-200 rounded-2xl p-4 bg-gray-50"
               >
                  <View className="flex-row items-center justify-between">
                     <View className="flex-row items-center gap-3 flex-1">
                        <View className="w-12 h-12 bg-white rounded-xl items-center justify-center border border-gray-200">
                           <FontAwesome6
                              name={getStoreIcon(store.name)}
                              size={20}
                              color={store.enabled ? "#10B981" : "#9CA3AF"}
                           />
                        </View>
                        <View className="flex-1">
                           <Text className="text-base font-bold text-gray-900 mb-1">
                              {store.name}
                           </Text>
                           <View className="flex-row items-center gap-3">
                              <View className="flex-row items-center gap-1">
                                 <Ionicons name="location-outline" size={14} color="#6B7280" />
                                 <Text className="text-xs text-gray-600">
                                    {store.location}
                                 </Text>
                              </View>
                              <View className="flex-row items-center gap-1">
                                 <Ionicons name="time-outline" size={14} color="#6B7280" />
                                 <Text className="text-xs text-gray-600">
                                    {store.frequency}
                                 </Text>
                              </View>
                           </View>
                           <Text className="text-xs text-gray-500 mt-1">
                              {store.visitsThisYear} visits this year
                           </Text>
                        </View>
                     </View>
                     <Switch
                        value={store.enabled}
                        onValueChange={() => toggleStore(index)}
                        trackColor={{
                           false: "#E5E7EB",
                           true: "#10B981",
                        }}
                        thumbColor={store.enabled ? "#FFFFFF" : "#9CA3AF"}
                     />
                  </View>
               </View>
            ))}
         </View>

         {/* Tip Banner */}
         <View className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <View className="flex-row items-start gap-3">
               <Ionicons name="bulb-outline" size={20} color="#10B981" />
               <Text className="text-sm text-emerald-800 leading-5 flex-1">
                  <Text className="font-semibold">Tip:</Text> Enable all stores. Compare
                  prices across all retailers to maximize your savings, you can always
                  filter by a specific store.
               </Text>
            </View>
         </View>
      </View>
   );
}
