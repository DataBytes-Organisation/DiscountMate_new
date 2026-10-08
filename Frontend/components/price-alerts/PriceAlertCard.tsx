import React from "react";
import { Alert, Platform, Pressable, Switch, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { PriceAlert } from "../../types/PriceAlert";
import {
   describeCondition,
   describeDelivery,
   formatPrice,
} from "../../utils/priceAlertValidation";

type PriceAlertCardProps = {
   alert: PriceAlert;
   isSaving: boolean;
   onToggleStatus: () => void;
   onEdit: () => void;
   onDelete: () => void;
};

export default function PriceAlertCard({
   alert,
   isSaving,
   onToggleStatus,
   onEdit,
   onDelete,
}: PriceAlertCardProps) {
   const isEnabled = alert.status === "enabled";
   const channels = [alert.channels.email ? "Email" : null, alert.channels.push ? "Push" : null]
      .filter(Boolean)
      .join(" + ");

   const confirmDelete = () => {
      const message = `Remove the alert for "${alert.productName}"? This cannot be undone.`;

      if (Platform.OS === "web") {
         if (typeof window !== "undefined" && window.confirm(message)) {
            onDelete();
         }
         return;
      }

      Alert.alert("Delete alert", message, [
         { text: "Cancel", style: "cancel" },
         { text: "Delete", style: "destructive", onPress: onDelete },
      ]);
   };

   return (
      <View className="rounded-[24px] border border-gray-100 bg-white px-4 md:px-5 py-4 shadow-sm">
         <View className="flex-row items-start gap-3">
            <View
               className={`w-12 h-12 rounded-2xl items-center justify-center ${
                  isEnabled ? "bg-emerald-50" : "bg-gray-100"
               }`}
            >
               <Ionicons
                  name={isEnabled ? "notifications-outline" : "notifications-off-outline"}
                  size={22}
                  color={isEnabled ? "#10B981" : "#9CA3AF"}
               />
            </View>

            <View className="flex-1 pr-2">
               <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="text-base font-semibold text-gray-900" numberOfLines={2}>
                     {alert.productName}
                  </Text>
                  <View
                     className={`px-2 py-0.5 rounded-md ${
                        isEnabled ? "bg-primary_green/15" : "bg-gray-200"
                     }`}
                  >
                     <Text
                        className={`text-[10px] font-bold uppercase ${
                           isEnabled ? "text-primary_green" : "text-gray-600"
                        }`}
                     >
                        {isEnabled ? "Enabled" : "Disabled"}
                     </Text>
                  </View>
               </View>
               <Text className="mt-0.5 text-xs text-gray-400">Code {alert.productCode}</Text>
               <Text className="mt-1 text-sm font-medium text-gray-700">
                  {describeCondition(alert)}
               </Text>
               <Text className="mt-0.5 text-xs text-gray-500">
                  Notify by {channels || "no channels"}
               </Text>
            </View>

            <View className="items-end gap-1">
               <Switch
                  value={isEnabled}
                  onValueChange={onToggleStatus}
                  disabled={isSaving}
                  trackColor={{ false: "#E5E7EB", true: "#10B981" }}
                  thumbColor="#FFFFFF"
               />
               {isSaving && <Text className="text-xs text-gray-400">Saving...</Text>}
            </View>
         </View>

         <View className="mt-3 gap-1">
            <Text className="text-xs text-gray-500">
               {alert.lastTriggeredAt
                  ? `Last triggered ${new Date(alert.lastTriggeredAt).toLocaleString()} at ${formatPrice(alert.lastPriceSeen)}`
                  : "Not triggered yet"}
            </Text>
            <Text className="text-xs text-gray-500">{describeDelivery(alert.lastDelivery)}</Text>
         </View>

         <View className="mt-4 flex-row items-center gap-2">
            <Pressable
               onPress={onEdit}
               disabled={isSaving}
               className="flex-row items-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-white border border-gray-200"
            >
               <Ionicons name="create-outline" size={16} color="#6B7280" />
               <Text className="text-sm font-semibold text-gray-700">Edit</Text>
            </Pressable>
            <Pressable
               onPress={confirmDelete}
               disabled={isSaving}
               className="flex-row items-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-white border border-gray-200"
            >
               <Ionicons name="trash-outline" size={16} color="#EF4444" />
               <Text className="text-sm font-semibold text-red-600">Delete</Text>
            </Pressable>
         </View>
      </View>
   );
}
