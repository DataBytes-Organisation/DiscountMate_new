import React, { useState } from "react";
import { View, Text, Switch, Pressable } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function ProfileNotificationPreferencesSection() {
   // Mock data - replace with actual notification preferences
   const [notifications, setNotifications] = useState({
      priceDropAlerts: true,
      weeklySavingsReport: true,
      newSpecials: true,
      shoppingListReminders: false,
      marketingCommunications: false,
   });

   const [notificationMethods, setNotificationMethods] = useState({
      email: true,
      sms: true,
      push: false,
   });

   const toggleNotification = (key: keyof typeof notifications) => {
      setNotifications({ ...notifications, [key]: !notifications[key] });
   };

   const toggleMethod = (key: keyof typeof notificationMethods) => {
      setNotificationMethods({
         ...notificationMethods,
         [key]: !notificationMethods[key],
      });
   };

   return (
      <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-6 shadow-sm">
         <View className="mb-5">
            <Text className="text-xl font-bold text-gray-900 mb-2">
               Notification Preferences
            </Text>
            <Text className="text-sm text-gray-600">
               Choose how to get notified about deals and important updates
            </Text>
         </View>

         <View className="gap-4">
            {/* Notification Types */}
            <View className="gap-3">
               {[
                  {
                     key: "priceDropAlerts" as const,
                     label: "Price Drop Alerts",
                     icon: "trending-down",
                  },
                  {
                     key: "weeklySavingsReport" as const,
                     label: "Weekly Savings Report",
                     icon: "document-text",
                  },
                  {
                     key: "newSpecials" as const,
                     label: "New Specials",
                     icon: "pricetag",
                  },
                  {
                     key: "shoppingListReminders" as const,
                     label: "Shopping List Reminders",
                     icon: "list",
                  },
                  {
                     key: "marketingCommunications" as const,
                     label: "Marketing Communications",
                     icon: "mail",
                  },
               ].map((item) => (
                  <View
                     key={item.key}
                     className="flex-row items-center justify-between py-2"
                  >
                     <View className="flex-row items-center gap-3 flex-1">
                        <Ionicons name={item.icon} size={20} color="#6B7280" />
                        <Text className="text-base text-gray-900">{item.label}</Text>
                     </View>
                     <Switch
                        value={notifications[item.key]}
                        onValueChange={() => toggleNotification(item.key)}
                        trackColor={{ false: "#E5E7EB", true: "#10B981" }}
                        thumbColor={
                           notifications[item.key] ? "#FFFFFF" : "#9CA3AF"
                        }
                     />
                  </View>
               ))}
            </View>

            {/* Divider */}
            <View className="h-px bg-gray-200 my-2" />

            {/* Notification Methods */}
            <View>
               <Text className="text-base font-semibold text-gray-900 mb-3">
                  Notification Methods
               </Text>
               <View className="gap-3">
                  <Pressable
                     onPress={() => toggleMethod("email")}
                     className="flex-row items-center justify-between py-2"
                  >
                     <View className="flex-row items-center gap-3 flex-1">
                        <Ionicons name="mail-outline" size={20} color="#6B7280" />
                        <View>
                           <Text className="text-base text-gray-900">
                              Email Notifications
                           </Text>
                           <Text className="text-xs text-gray-500">
                              sarah.mitchell@email.com
                           </Text>
                        </View>
                     </View>
                     <View
                        className={`w-5 h-5 rounded border-2 items-center justify-center ${notificationMethods.email
                              ? "bg-primary_green border-primary_green"
                              : "border-gray-300"
                           }`}
                     >
                        {notificationMethods.email && (
                           <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        )}
                     </View>
                  </Pressable>

                  <Pressable
                     onPress={() => toggleMethod("sms")}
                     className="flex-row items-center justify-between py-2"
                  >
                     <View className="flex-row items-center gap-3 flex-1">
                        <Ionicons name="chatbubble-outline" size={20} color="#6B7280" />
                        <View>
                           <Text className="text-base text-gray-900">
                              SMS Notifications
                           </Text>
                           <Text className="text-xs text-gray-500">
                              +01 412 345 678
                           </Text>
                        </View>
                     </View>
                     <View
                        className={`w-5 h-5 rounded border-2 items-center justify-center ${notificationMethods.sms
                              ? "bg-primary_green border-primary_green"
                              : "border-gray-300"
                           }`}
                     >
                        {notificationMethods.sms && (
                           <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        )}
                     </View>
                  </Pressable>

                  <Pressable
                     onPress={() => toggleMethod("push")}
                     className="flex-row items-center justify-between py-2"
                  >
                     <View className="flex-row items-center gap-3 flex-1">
                        <Ionicons name="notifications-outline" size={20} color="#6B7280" />
                        <View>
                           <Text className="text-base text-gray-900">
                              Push Notifications
                           </Text>
                           <Text className="text-xs text-gray-500">
                              Not set up yet, enable from your device settings
                           </Text>
                        </View>
                     </View>
                     <View
                        className={`w-5 h-5 rounded border-2 items-center justify-center ${notificationMethods.push
                              ? "bg-primary_green border-primary_green"
                              : "border-gray-300"
                           }`}
                     >
                        {notificationMethods.push && (
                           <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        )}
                     </View>
                  </Pressable>
               </View>
            </View>
         </View>
      </View>
   );
}
