import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { fetchPriceAlerts } from "../../services/priceAlerts";
import { PriceAlert } from "../../types/PriceAlert";
import { describeCondition } from "../../utils/priceAlertValidation";

export default function PriceAlertsSection() {
   const router = useRouter();
   const [loggedIn, setLoggedIn] = useState(false);
   const [alerts, setAlerts] = useState<PriceAlert[]>([]);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
      let active = true;

      const loadAlerts = async () => {
         try {
            const token = await AsyncStorage.getItem("authToken");
            if (!token) return;
            const response = await fetchPriceAlerts();
            if (active) {
               setLoggedIn(true);
               setAlerts(response.slice(0, 3));
            }
         } catch {
            if (active) setAlerts([]);
         } finally {
            if (active) setLoading(false);
         }
      };

      loadAlerts();
      return () => {
         active = false;
      };
   }, []);

   const target = loggedIn ? "/price-alerts" : "/login";

   return (
      <View className="bg-light border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
            <View className="mb-10">
               <Text className="text-3xl font-bold text-[#111827] mb-2">Price Alerts & Notifications</Text>
               <Text className="text-gray-600">Never miss a deal on your favorite products</Text>
            </View>

            <View className="bg-white border border-gray-200 rounded-2xl p-10 shadow-lg">
               <View className="flex flex-col md:flex-row gap-10">
                  <View className="flex-1">
                     <View className="flex-row items-center gap-4 mb-8">
                        <View className="w-14 h-14 bg-green-50 rounded-xl items-center justify-center">
                           <FontAwesome6 name="bell" size={20} color="#10B981" solid />
                        </View>
                        <View>
                           <Text className="text-lg font-bold text-[#111827]">Active Alerts</Text>
                           <Text className="text-sm text-gray-600">Your most recent price alerts</Text>
                        </View>
                     </View>

                     <View className="gap-4">
                        {loading && <ActivityIndicator color="#10B981" />}
                        {!loading && alerts.length === 0 && (
                           <View className="p-5 bg-light rounded-xl border border-gray-100">
                              <Text className="text-sm text-gray-700">
                                 {loggedIn
                                    ? "No alerts yet. Create one to start tracking a product."
                                    : "Log in to see your alerts and create new ones."}
                              </Text>
                           </View>
                        )}
                        {alerts.map((alert) => (
                           <Pressable
                              key={alert.id}
                              onPress={() => router.push(target)}
                              className="flex-row items-center justify-between p-5 bg-light rounded-xl border border-gray-100"
                           >
                              <View className="flex-1 pr-3">
                                 <Text className="text-sm font-semibold text-[#111827]" numberOfLines={1}>
                                    {alert.productName}
                                 </Text>
                                 <Text className="text-xs text-gray-500">{describeCondition(alert)}</Text>
                              </View>
                              <Text className="text-xs font-semibold text-primary_green">
                                 {alert.status === "enabled" ? "Enabled" : "Disabled"}
                              </Text>
                           </Pressable>
                        ))}
                     </View>
                  </View>

                  <View className="flex-1">
                     <View className="flex-row items-center gap-4 mb-8">
                        <View className="w-14 h-14 bg-green-50 rounded-xl items-center justify-center">
                           <FontAwesome6 name="chart-line" size={20} color="#10B981" />
                        </View>
                        <View>
                           <Text className="text-lg font-bold text-[#111827]">Set New Alert</Text>
                           <Text className="text-sm text-gray-600">Track prices on any product</Text>
                        </View>
                     </View>

                     <Pressable
                        onPress={() => router.push(target)}
                        className="w-full py-4 min-h-[44px] bg-primary_green rounded-xl items-center justify-center"
                     >
                        <Text className="text-white font-semibold">
                           {loggedIn ? "Manage alerts" : "Log in to create an alert"}
                        </Text>
                     </Pressable>
                  </View>
               </View>
            </View>
         </View>
      </View>
   );
}
