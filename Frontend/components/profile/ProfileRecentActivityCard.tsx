import React from "react";
import { View, Text, ScrollView } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function ProfileRecentActivityCard() {
   // Mock data - replace with actual activity data
   const activities = [
      {
         icon: "list",
         text: "Updated 'Weekly Essentials' list",
         time: "2 hours ago",
      },
      {
         icon: "notifications",
         text: "Price alert triggered for olive oil",
         time: "1 day ago",
      },
      {
         icon: "cart",
         text: "Completed shopping trip",
         time: "2 days ago",
      },
      {
         icon: "heart",
         text: "Added 3 products to favorites",
         time: "3 days ago",
      },
      {
         icon: "alarm",
         text: "Created new price alert",
         time: "5 days ago",
      },
   ];

   return (
      <View className="bg-white rounded-3xl border border-gray-200 p-5 mb-6 shadow-sm">
         <View className="flex-row items-center gap-2 mb-5">
            <View className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl items-center justify-center">
               <Ionicons name="time-outline" size={18} color="#FFFFFF" />
            </View>
            <Text className="text-lg font-bold text-gray-900">
               Recent Activity
            </Text>
         </View>

         <View className="gap-3">
            {activities.map((activity, index) => (
               <View
                  key={index}
                  className="flex-row items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0"
               >
                  <View className="w-8 h-8 bg-gray-100 rounded-lg items-center justify-center mt-0.5">
                     <Ionicons name={activity.icon} size={16} color="#6B7280" />
                  </View>
                  <View className="flex-1">
                     <Text className="text-sm text-gray-900 leading-5">
                        {activity.text}
                     </Text>
                     <Text className="text-xs text-gray-500 mt-1">
                        {activity.time}
                     </Text>
                  </View>
               </View>
            ))}
         </View>
      </View>
   );
}
