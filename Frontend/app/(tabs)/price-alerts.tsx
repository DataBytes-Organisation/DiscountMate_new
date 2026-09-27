import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "react-native-vector-icons/Ionicons";
import UserHubSidebar from "../../components/common/UserHubSidebar";
import PriceAlertCard from "../../components/price-alerts/PriceAlertCard";
import PriceAlertForm from "../../components/price-alerts/PriceAlertForm";
import { useUserProfile } from "../../context/UserProfileContext";
import {
   createPriceAlert,
   deletePriceAlert,
   fetchPriceAlerts,
   setPriceAlertStatus,
   updatePriceAlert,
} from "../../services/priceAlerts";
import { PriceAlert, PriceAlertInput } from "../../types/PriceAlert";
import { SESSION_EXPIRED_MESSAGE } from "../../utils/authSession";

function getDisplayName(firstName?: string, lastName?: string) {
   return `${firstName ?? ""} ${lastName ?? ""}`.trim() || "DiscountMate Member";
}

function sortNewestFirst(alerts: PriceAlert[]) {
   return [...alerts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
   );
}

export default function PriceAlertsScreen() {
   const router = useRouter();
   const { profile } = useUserProfile();
   const [alerts, setAlerts] = useState<PriceAlert[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [successMessage, setSuccessMessage] = useState<string | null>(null);
   const [savingId, setSavingId] = useState<string | null>(null);
   const [formVisible, setFormVisible] = useState(false);
   const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);

   const showError = (message: string) => {
      setError(message);
      if (message === SESSION_EXPIRED_MESSAGE) {
         router.replace("/login");
      }
   };

   useEffect(() => {
      let active = true;

      const loadPriceAlerts = async () => {
         setLoading(true);
         setError(null);

         try {
            const response = await fetchPriceAlerts();
            if (active) {
               setAlerts(sortNewestFirst(response));
            }
         } catch (err: any) {
            if (active) {
               const message = err?.message || "Unable to load price alerts.";
               setError(message);
               if (message === SESSION_EXPIRED_MESSAGE) {
                  router.replace("/login");
               }
            }
         } finally {
            if (active) {
               setLoading(false);
            }
         }
      };

      loadPriceAlerts();

      return () => {
         active = false;
      };
   }, []);

   const displayName = useMemo(
      () => getDisplayName(profile?.firstName, profile?.lastName),
      [profile?.firstName, profile?.lastName]
   );
   const membershipLabel = useMemo(() => {
      const plan = String(profile?.subscriptionPlan || "free");
      return `${plan.charAt(0).toUpperCase()}${plan.slice(1)} Member`;
   }, [profile?.subscriptionPlan]);

   const openForm = (alert: PriceAlert | null) => {
      setEditingAlert(alert);
      setFormVisible(true);
      setSuccessMessage(null);
   };

   const handleSave = async (input: PriceAlertInput) => {
      setError(null);
      try {
         if (editingAlert) {
            const savedAlert = await updatePriceAlert(editingAlert.id, {
               condition: input.condition,
               threshold: input.threshold,
               channels: input.channels,
            });
            setAlerts((current) =>
               current.map((alert) => (alert.id === savedAlert.id ? savedAlert : alert))
            );
            setSuccessMessage(`Alert for ${savedAlert.productName} updated.`);
         } else {
            const createdAlert = await createPriceAlert(input);
            setAlerts((current) => [createdAlert, ...current]);
            setSuccessMessage(`Alert for ${createdAlert.productName} created.`);
         }
      } catch (err: any) {
         if (err?.message === SESSION_EXPIRED_MESSAGE) {
            showError(err.message);
         }
         throw err;
      }
   };

   const handleToggleStatus = async (alert: PriceAlert) => {
      const previousAlerts = alerts;
      const nextStatus = alert.status === "enabled" ? "disabled" : "enabled";

      setAlerts(
         alerts.map((currentAlert) =>
            currentAlert.id === alert.id ? { ...currentAlert, status: nextStatus } : currentAlert
         )
      );
      setSavingId(alert.id);
      setError(null);
      setSuccessMessage(null);

      try {
         const savedAlert = await setPriceAlertStatus(alert.id, nextStatus);
         setAlerts((current) =>
            current.map((currentAlert) =>
               currentAlert.id === savedAlert.id ? savedAlert : currentAlert
            )
         );
         setSuccessMessage(`Alert for ${savedAlert.productName} ${nextStatus}.`);
      } catch (err: any) {
         setAlerts(previousAlerts);
         showError(err?.message || "Unable to update price alert.");
      } finally {
         setSavingId(null);
      }
   };

   const handleDelete = async (alert: PriceAlert) => {
      const previousAlerts = alerts;

      setAlerts(alerts.filter((currentAlert) => currentAlert.id !== alert.id));
      setSavingId(alert.id);
      setError(null);
      setSuccessMessage(null);

      try {
         await deletePriceAlert(alert.id);
         setSuccessMessage(`Alert for ${alert.productName} deleted.`);
      } catch (err: any) {
         setAlerts(previousAlerts);
         showError(err?.message || "Unable to delete price alert.");
      } finally {
         setSavingId(null);
      }
   };

   return (
      <View className="flex-1 bg-[#F7F8F4]">
         <View className="flex-col lg:flex-row">
            <UserHubSidebar
               activeKey="price-alerts"
               displayName={displayName}
               email={profile?.email}
               membershipLabel={membershipLabel}
               profileImage={profile?.profileImage}
            />

            <View className="flex-1 px-3 md:px-5 xl:px-6 py-4 md:py-5">
               {error && (
                  <View className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                     <Text className="text-sm text-red-700">{error}</Text>
                  </View>
               )}

               {successMessage && (
                  <View className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                     <Text className="text-sm text-emerald-700">{successMessage}</Text>
                  </View>
               )}

               {loading ? (
                  <View className="rounded-3xl border border-gray-100 bg-white px-5 py-8 flex-row items-center gap-3">
                     <ActivityIndicator color="#10B981" />
                     <Text className="text-gray-700">Loading your price alerts...</Text>
                  </View>
               ) : (
                  <View className="max-w-[1480px] w-full gap-4">
                     <View className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm flex-col md:flex-row md:items-center gap-4">
                        <View className="flex-1">
                           <Text className="text-2xl font-bold text-gray-900">Price Alerts</Text>
                           <Text className="mt-2 text-sm text-gray-500 leading-6">
                              Track specific products and get an email or push notification
                              when they hit your target price or discount.
                           </Text>
                        </View>
                        <Pressable
                           onPress={() => openForm(null)}
                           className="min-h-[44px] px-4 rounded-xl bg-primary_green items-center justify-center flex-row gap-2"
                        >
                           <Ionicons name="add" size={18} color="#FFFFFF" />
                           <Text className="font-semibold text-white">New alert</Text>
                        </Pressable>
                     </View>

                     {alerts.length === 0 ? (
                        <View className="rounded-3xl border border-gray-200 bg-white px-6 py-8 items-center">
                           <Ionicons name="notifications-outline" size={26} color="#10B981" />
                           <Text className="mt-3 text-lg font-bold text-gray-900">No price alerts yet</Text>
                           <Text className="mt-1 text-sm text-gray-600 text-center">
                              Pick a product and set a target price or discount to get started.
                           </Text>
                        </View>
                     ) : (
                        <View className="gap-3">
                           {alerts.map((alert) => (
                              <PriceAlertCard
                                 key={alert.id}
                                 alert={alert}
                                 isSaving={savingId === alert.id}
                                 onToggleStatus={() => handleToggleStatus(alert)}
                                 onEdit={() => openForm(alert)}
                                 onDelete={() => handleDelete(alert)}
                              />
                           ))}
                        </View>
                     )}
                  </View>
               )}
            </View>
         </View>

         <PriceAlertForm
            visible={formVisible}
            editingAlert={editingAlert}
            existingAlerts={alerts}
            onClose={() => setFormVisible(false)}
            onSave={handleSave}
         />
      </View>
   );
}
