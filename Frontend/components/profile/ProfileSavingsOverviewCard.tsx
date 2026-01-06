import React from "react";
import { View, Text } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export default function ProfileSavingsOverviewCard() {
   // Mock data - replace with actual data
   const savings = {
      thisMonth: 124.80,
      thisYear: 487.60,
      averagePerTrip: 21.20,
      totalTrips: 23,
      bestSaving: {
         amount: 45.30,
         store: "Woolworths",
      },
   };

   return (
      <View className="bg-white rounded-3xl border border-gray-200 p-5 mb-6 shadow-sm">
         <View className="flex-row items-center gap-2 mb-5">
            <View className="w-10 h-10 bg-gradient-to-br from-primary_green to-secondary_green rounded-xl items-center justify-center">
               <FontAwesome6 name="dollar-sign" size={18} color="#FFFFFF" />
            </View>
            <Text className="text-lg font-bold text-gray-900">
               Your Savings Overview
            </Text>
         </View>

         <View className="gap-4">
            {/* This Month */}
            <View className="pb-4 border-b border-gray-100">
               <Text className="text-sm text-gray-600 mb-1">This Month</Text>
               <Text className="text-2xl font-bold text-primary_green">
                  ${savings.thisMonth.toFixed(2)}
               </Text>
            </View>

            {/* This Year */}
            <View className="pb-4 border-b border-gray-100">
               <Text className="text-sm text-gray-600 mb-1">This Year</Text>
               <Text className="text-2xl font-bold text-primary_green">
                  ${savings.thisYear.toFixed(2)}
               </Text>
            </View>

            {/* Average per Trip */}
            <View className="pb-4 border-b border-gray-100">
               <Text className="text-sm text-gray-600 mb-1">
                  Average per {savings.totalTrips} trips
               </Text>
               <Text className="text-xl font-bold text-gray-900">
                  ${savings.averagePerTrip.toFixed(2)}
               </Text>
            </View>

            {/* Best Saving */}
            <View>
               <Text className="text-sm text-gray-600 mb-1">Best Saving</Text>
               <Text className="text-xl font-bold text-primary_green">
                  ${savings.bestSaving.amount.toFixed(2)}
               </Text>
               <Text className="text-xs text-gray-500 mt-1">
                  on an item from {savings.bestSaving.store}
               </Text>
            </View>
         </View>
      </View>
   );
}
