import React from "react";
import { View, Text, Pressable } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function ProfileAccountActionsCard() {
   const actions = [
      {
         icon: "download-outline",
         label: "Import Data",
         color: "#3B82F6",
      },
      {
         icon: "lock-closed-outline",
         label: "Change Password",
         color: "#6366F1",
      },
      {
         icon: "shield-checkmark-outline",
         label: "Privacy Settings",
         color: "#8B5CF6",
      },
      {
         icon: "trash-outline",
         label: "Delete Account",
         color: "#EF4444",
      },
   ];

   return (
      <View className="bg-white rounded-3xl border border-gray-200 p-5 mb-6 shadow-sm">
         <View className="flex-row items-center gap-2 mb-5">
            <View className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl items-center justify-center">
               <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
            </View>
            <Text className="text-lg font-bold text-gray-900">
               Account Actions
            </Text>
         </View>

         <View className="gap-2">
            {actions.map((action, index) => (
               <Pressable
                  key={index}
                  className="flex-row items-center gap-3 p-3 rounded-xl bg-gray-50 active:bg-gray-100"
               >
                  <Ionicons name={action.icon} size={20} color={action.color} />
                  <Text className="text-sm font-medium text-gray-900 flex-1">
                     {action.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
               </Pressable>
            ))}
         </View>
      </View>
   );
}
