import React from "react";
import { View, Text, Pressable } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export default function ProfilePriceAlertsSection() {
   // Mock data - replace with actual price alerts
   const priceAlerts = [
      {
         productName: "Coffee Beans Premium 1kg",
         targetPrice: 12.99,
         currentPrice: 15.50,
         activeSince: "Jan 15, 2025",
         triggered: false,
      },
      {
         productName: "Olive Oil Extra Virgin 1L",
         targetPrice: 8.50,
         currentPrice: 8.45,
         activeSince: "Jan 10, 2025",
         triggered: true,
      },
      {
         productName: "Organic Milk 2L",
         targetPrice: 4.50,
         currentPrice: 5.20,
         activeSince: "Jan 20, 2025",
         triggered: false,
      },
      {
         productName: "Whole Wheat Bread",
         targetPrice: 3.00,
         currentPrice: 3.50,
         activeSince: "Jan 18, 2025",
         triggered: false,
      },
      {
         productName: "Free Range Eggs 12pk",
         targetPrice: 5.50,
         currentPrice: 6.00,
         activeSince: "Jan 22, 2025",
         triggered: false,
      },
   ];

   return (
      <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-6 shadow-sm">
         <View className="mb-5">
            <Text className="text-xl font-bold text-gray-900 mb-2">
               Active Price Alerts
            </Text>
            <Text className="text-sm text-gray-600">
               You&apos;re notified when products reach your target price
            </Text>
         </View>

         <View className="gap-3">
            {priceAlerts.map((alert, index) => (
               <View
                  key={index}
                  className={`border rounded-2xl p-4 ${alert.triggered
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-gray-50 border-gray-200"
                     }`}
               >
                  <View className="flex-row items-start justify-between mb-2">
                     <View className="flex-row items-center gap-3 flex-1">
                        <View className="w-12 h-12 bg-white rounded-xl items-center justify-center border border-gray-200">
                           <FontAwesome6 name="tag" size={20} color="#6B7280" />
                        </View>
                        <View className="flex-1">
                           <Text className="text-base font-semibold text-gray-900 mb-1">
                              {alert.productName}
                           </Text>
                           {alert.triggered && (
                              <View className="flex-row items-center gap-1 bg-emerald-100 px-2 py-1 rounded-lg self-start">
                                 <Ionicons name="flash" size={12} color="#10B981" />
                                 <Text className="text-xs font-semibold text-emerald-700">
                                    Live now!
                                 </Text>
                              </View>
                           )}
                        </View>
                     </View>
                     <View className="flex-row gap-2">
                        <Pressable className="w-8 h-8 items-center justify-center rounded-lg bg-white border border-gray-200">
                           <Ionicons name="create-outline" size={16} color="#6B7280" />
                        </Pressable>
                        <Pressable className="w-8 h-8 items-center justify-center rounded-lg bg-white border border-gray-200">
                           <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </Pressable>
                     </View>
                  </View>

                  <View className="flex-row items-center gap-4 mt-3">
                     <View>
                        <Text className="text-xs text-gray-500 mb-1">Target Price</Text>
                        <Text className="text-base font-bold text-primary_green">
                           ${alert.targetPrice.toFixed(2)}
                        </Text>
                     </View>
                     <View>
                        <Text className="text-xs text-gray-500 mb-1">Current Price</Text>
                        <Text
                           className={`text-base font-bold ${alert.triggered ? "text-emerald-600" : "text-gray-900"
                              }`}
                        >
                           ${alert.currentPrice.toFixed(2)}
                        </Text>
                     </View>
                     <View className="flex-1">
                        <Text className="text-xs text-gray-500 mb-1">Active since</Text>
                        <Text className="text-sm text-gray-700">{alert.activeSince}</Text>
                     </View>
                  </View>
               </View>
            ))}
         </View>

         {/* Info Banner */}
         <View className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <Text className="text-sm text-emerald-800 leading-5">
               <Text className="font-semibold">10 of your alerts</Text> are close to
               triggering, we&apos;ll notify you as soon as the price drops.
            </Text>
         </View>
      </View>
   );
}
