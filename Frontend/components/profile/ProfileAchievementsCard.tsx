import React from "react";
import { View, Text } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function ProfileAchievementsCard() {
   // Mock data - replace with actual achievements
   const achievements = [
      {
         name: "Super Saver",
         description: "Saved over $500",
         icon: "trophy",
         color: "orange",
         unlocked: true,
      },
      {
         name: "Deal Hunter",
         description: "Earn 50 Price Alerts",
         icon: "search",
         color: "orange",
         unlocked: true,
      },
      {
         name: "Price Master",
         description: "Save 100 Price Alerts",
         icon: "star",
         color: "gray",
         unlocked: false,
      },
   ];

   const getColorClasses = (color: string, unlocked: boolean) => {
      if (!unlocked) {
         return {
            bg: "bg-gray-100",
            icon: "#9CA3AF",
            text: "text-gray-400",
         };
      }
      switch (color) {
         case "orange":
            return {
               bg: "bg-orange-100",
               icon: "#F97316",
               text: "text-orange-700",
            };
         default:
            return {
               bg: "bg-gray-100",
               icon: "#9CA3AF",
               text: "text-gray-400",
            };
      }
   };

   return (
      <View className="bg-white rounded-3xl border border-gray-200 p-5 mb-6 shadow-sm">
         <View className="flex-row items-center gap-2 mb-5">
            <View className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl items-center justify-center">
               <FontAwesome6 name="trophy" size={18} color="#FFFFFF" />
            </View>
            <Text className="text-lg font-bold text-gray-900">
               Achievements
            </Text>
         </View>

         <View className="gap-3">
            {achievements.map((achievement, index) => {
               const colors = getColorClasses(achievement.color, achievement.unlocked);
               return (
                  <View
                     key={index}
                     className={`${colors.bg} rounded-2xl p-4 flex-row items-center gap-3`}
                  >
                     <View className="w-12 h-12 bg-white rounded-xl items-center justify-center">
                        <FontAwesome6
                           name={achievement.icon}
                           size={20}
                           color={colors.icon}
                        />
                     </View>
                     <View className="flex-1">
                        <Text className={`font-bold ${colors.text} mb-1`}>
                           {achievement.name}
                        </Text>
                        <Text className={`text-xs ${colors.text}`}>
                           {achievement.description}
                        </Text>
                     </View>
                     {achievement.unlocked && (
                        <Ionicons name="checkmark-circle" size={24} color={colors.icon} />
                     )}
                  </View>
               );
            })}
         </View>
      </View>
   );
}
