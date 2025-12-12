import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import Ionicons from "react-native-vector-icons/Ionicons";

type ProfileTabKey =
   | "account"
   | "shoppingLists"
   | "priceAlerts"
   | "preferredStores"
   | "preferences"
   | "privacy";

const PROFILE_TABS: { key: ProfileTabKey; label: string }[] = [
   { key: "account", label: "Account Info" },
   { key: "shoppingLists", label: "Shopping Lists" },
   { key: "priceAlerts", label: "Price Alerts" },
   { key: "preferredStores", label: "Preferred Stores" },
   { key: "preferences", label: "Preferences" },
   { key: "privacy", label: "Privacy" },
];

export default function ProfileHeaderCard() {
   // Mock data - replace with actual user data
   const user = {
      name: "Sarah Mitchell",
      memberSince: "January 2024",
      totalSaved: 487.6,
      shoppingTrips: 23,
      activeAlerts: 8,
      shoppingLists: 5,
   };

   const [activeTab, setActiveTab] = React.useState<ProfileTabKey>("account");

   return (
      <View className="bg-white border border-gray-200 shadow-sm overflow-hidden">
         {/* Header + Stats background */}
         <View className="px-6 pt-6 pb-6 bg-[#EAF7F1]">
            {/* Top row: avatar, name, edit button */}
            <View className="flex-row items-center justify-between">
               {/* Left: Avatar & Name */}
               <View className="flex-row items-center gap-4 flex-1">
                  <View className="relative">
                     <View className="w-20 h-20 rounded-full bg-gradient-to-br from-primary_green to-secondary_green items-center justify-center">
                        <FontAwesome6 name="user" size={32} color="#FFFFFF" />
                     </View>
                     <View className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary_green rounded-full border-2 border-white items-center justify-center">
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                     </View>
                  </View>

                  <View className="flex-1">
                     <Text className="text-2xl font-bold text-gray-900">
                        {user.name}
                     </Text>
                     <View className="flex-row items-center mt-1">
                        <Ionicons
                           name="calendar-outline"
                           size={14}
                           color="#6B7280"
                        />
                        <Text className="ml-2 text-sm text-gray-600">
                           Member since {user.memberSince}
                        </Text>
                     </View>
                  </View>
               </View>

               {/* Right: Edit Profile Button */}
               <Pressable className="bg-primary_green px-5 py-2.5 flex-row items-center gap-2">
                  <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                  <Text className="text-white font-semibold">Edit Profile</Text>
               </Pressable>
            </View>

            {/* Metrics row */}
            <View className="flex-row flex-wrap gap-4 mt-6">
               {/* Total Saved */}
               <View className="flex-1 min-w-[150px] bg-white px-5 py-4 border border-emerald-100">
                  <Text className="text-2xl font-bold text-primary_green">
                     ${user.totalSaved.toFixed(2)}
                  </Text>
                  <Text className="mt-1 text-sm text-gray-600">Total Saved</Text>
                  <View className="h-1.5 bg-emerald-100 rounded-full mt-3 overflow-hidden">
                     <View
                        className="h-full bg-primary_green rounded-full"
                        style={{ width: "75%" }}
                     />
                  </View>
               </View>

               {/* Shopping Trips */}
               <View className="flex-1 min-w-[150px] bg-white px-5 py-4 border border-gray-200 items-center">
                  <Text className="text-2xl font-bold text-gray-900">
                     {user.shoppingTrips}
                  </Text>
                  <Text className="mt-1 text-sm text-gray-600">Shopping Trips</Text>
                  <View className="flex-row mt-3 gap-1">
                     <Ionicons name="basket-outline" size={16} color="#16A34A" />
                     <Ionicons name="basket-outline" size={16} color="#16A34A" />
                     <Ionicons name="basket-outline" size={16} color="#16A34A" />
                  </View>
               </View>

               {/* Active Alerts */}
               <View className="flex-1 min-w-[150px] bg-white px-5 py-4 border border-gray-200 items-center">
                  <Text className="text-2xl font-bold text-gray-900">
                     {user.activeAlerts}
                  </Text>
                  <Text className="mt-1 text-sm text-gray-600">Active Alerts</Text>
                  <View className="mt-3">
                     <Ionicons
                        name="notifications-outline"
                        size={18}
                        color="#16A34A"
                     />
                  </View>
               </View>

               {/* Shopping Lists */}
               <View className="flex-1 min-w-[150px] bg-white px-5 py-4 border border-gray-200 items-center">
                  <Text className="text-2xl font-bold text-gray-900">
                     {user.shoppingLists}
                  </Text>
                  <Text className="mt-1 text-sm text-gray-600">Shopping Lists</Text>
                  <View className="mt-3">
                     <Ionicons name="list-outline" size={18} color="#16A34A" />
                  </View>
               </View>
            </View>
         </View>

         {/* Tabs row */}
         <View className="border-t border-gray-200 bg-white">
            <ScrollView
               horizontal
               showsHorizontalScrollIndicator={false}
               contentContainerStyle={{ paddingHorizontal: 24 }}
            >
               <View className="flex-row">
                  {PROFILE_TABS.map((tab) => {
                     const isActive = tab.key === activeTab;
                     return (
                        <Pressable
                           key={tab.key}
                           onPress={() => setActiveTab(tab.key)}
                           className={`mr-8 pb-3 border-b-2 ${isActive ? "border-primary_green" : "border-transparent"
                              }`}
                        >
                           <Text
                              className={`text-sm ${isActive
                                 ? "text-primary_green font-semibold"
                                 : "text-gray-600"
                                 }`}
                           >
                              {tab.label}
                           </Text>
                        </Pressable>
                     );
                  })}
               </View>
            </ScrollView>
         </View>
      </View>
   );
}
