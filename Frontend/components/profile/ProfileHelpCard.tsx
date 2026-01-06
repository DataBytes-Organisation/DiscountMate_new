import React from "react";
import { View, Text, Pressable } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function ProfileHelpCard() {
   const helpLinks = [
      {
         icon: "help-circle-outline",
         label: "Help Center",
         color: "#3B82F6",
      },
      {
         icon: "chatbubbles-outline",
         label: "Contact Support",
         color: "#8B5CF6",
      },
      {
         icon: "play-circle-outline",
         label: "Video tutorials",
         color: "#10B981",
      },
   ];

   return (
      <View className="bg-gray-900 rounded-3xl border border-gray-800 p-5 shadow-sm">
         <View className="flex-row items-center gap-2 mb-5">
            <View className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl items-center justify-center">
               <Ionicons name="help-circle" size={18} color="#FFFFFF" />
            </View>
            <Text className="text-lg font-bold text-white">Need Help?</Text>
         </View>

         <View className="gap-2">
            {helpLinks.map((link, index) => (
               <Pressable
                  key={index}
                  className="flex-row items-center gap-3 p-3 rounded-xl bg-gray-800 active:bg-gray-700"
               >
                  <Ionicons name={link.icon} size={20} color={link.color} />
                  <Text className="text-sm font-medium text-white flex-1">
                     {link.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
               </Pressable>
            ))}
         </View>
      </View>
   );
}
