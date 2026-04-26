import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Switch, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import UserHubSidebar from "../../components/common/UserHubSidebar";
import { useUserProfile } from "../../context/UserProfileContext";
import {
   fetchNotificationPreferences,
   saveNotificationPreferences,
} from "../../services/notifications";
import { NotificationPreferences } from "../../types/NotificationPreferences";
import { SESSION_EXPIRED_MESSAGE } from "../../utils/authSession";
import { useRouter } from "expo-router";

const FALLBACK_PREFERENCES: NotificationPreferences = {
   alertTypes: {
      priceAlerts: true,
      browserNotifications: true,
      weeklySummary: true,
   },
};

const ALERT_TYPE_ITEMS: Array<{
   key: keyof NotificationPreferences["alertTypes"];
   title: string;
   subtitle: string;
   icon: string;
}> = [
   {
      key: "priceAlerts",
      title: "Price Alerts",
      subtitle: "Notify me in the bell panel when prices drop to my target.",
      icon: "notifications-outline",
   },
   {
      key: "weeklySummary",
      title: "Weekly Summary",
      subtitle: "Show a savings recap in your in-app notifications each week.",
      icon: "calendar-outline",
   },
   {
      key: "browserNotifications",
      title: "In-Browser Notifications",
      subtitle: "Show notifications in the DiscountMate bell panel while you use the app.",
      icon: "desktop-outline",
   },
];

function getDisplayName(firstName?: string, lastName?: string) {
   return `${firstName ?? ""} ${lastName ?? ""}`.trim() || "DiscountMate Member";
}

export default function NotificationsScreen() {
   const router = useRouter();
   const { profile } = useUserProfile();
   const [preferences, setPreferences] =
      useState<NotificationPreferences>(FALLBACK_PREFERENCES);
   const [loading, setLoading] = useState(true);
   const [savingKey, setSavingKey] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [successMessage, setSuccessMessage] = useState<string | null>(null);

   useEffect(() => {
      let active = true;

      const loadPreferences = async () => {
         setLoading(true);
         setError(null);
         try {
            const data = await fetchNotificationPreferences();
            if (active) {
               setPreferences(data);
            }
         } catch (err: any) {
            if (active) {
               const message =
                  err?.message || "Unable to load notification settings.";
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

      loadPreferences();

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

   const handleToggle = async (key: keyof NotificationPreferences["alertTypes"]) => {
      const previousPreferences = preferences;
      const nextPreferences: NotificationPreferences = {
         ...preferences,
         alertTypes: {
            ...preferences.alertTypes,
            [key]: !preferences.alertTypes[key],
         },
      };

      setPreferences(nextPreferences);
      setSavingKey(key);
      setError(null);
      setSuccessMessage(null);

      try {
         const saved = await saveNotificationPreferences(nextPreferences);
         setPreferences(saved);
         setSuccessMessage("Notification settings updated.");
      } catch (err: any) {
         const message =
            err?.message || "Unable to update notification settings.";
         setPreferences(previousPreferences);
         setError(message);
         if (message === SESSION_EXPIRED_MESSAGE) {
            router.replace("/login");
         }
      } finally {
         setSavingKey(null);
      }
   };

   return (
      <View className="flex-1 bg-[#F7F8F4]">
         <View className="flex-col lg:flex-row">
            <UserHubSidebar
               activeKey="notifications"
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
                     <Text className="text-gray-700">
                        Loading your notification settings...
                     </Text>
                  </View>
               ) : (
                  <View className="max-w-[1480px] w-full gap-4">
                     <View className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
                        <View className="flex-col md:flex-row md:items-start md:justify-between gap-4">
                           <View className="flex-1">
                              <Text className="text-2xl font-bold text-gray-900">
                                 Notification Settings
                              </Text>
                           </View>
                        </View>
                     </View>

                     <View className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
                        <Text className="text-lg font-bold text-gray-900">
                           Alert Types
                        </Text>
                        <Text className="text-sm text-gray-500 mt-2">
                           Visible settings here should all have a real effect in the notification bell.
                        </Text>

                        <View className="mt-6 gap-3">
                           {ALERT_TYPE_ITEMS.map((item) => {
                              const value = preferences.alertTypes[item.key];
                              const isSaving = savingKey === item.key;

                              return (
                                 <View
                                    key={item.key}
                                    className="rounded-3xl border border-gray-100 bg-[#FCFCFA] px-4 py-4"
                                 >
                                    <View className="flex-row items-center gap-3">
                                       <View className="w-11 h-11 rounded-2xl bg-emerald-50 items-center justify-center">
                                          <Ionicons
                                             name={item.icon}
                                             size={20}
                                             color="#10B981"
                                          />
                                       </View>
                                       <View className="flex-1 pr-3">
                                          <Text className="text-base font-semibold text-gray-900">
                                             {item.title}
                                          </Text>
                                          <Text className="text-sm text-gray-500 mt-1 leading-5">
                                             {item.subtitle}
                                          </Text>
                                       </View>
                                       <View className="items-end">
                                          <Switch
                                             value={value}
                                             onValueChange={() => handleToggle(item.key)}
                                             disabled={isSaving}
                                             trackColor={{ false: "#E5E7EB", true: "#10B981" }}
                                             thumbColor="#FFFFFF"
                                          />
                                          {isSaving && (
                                             <Text className="text-xs text-gray-400 mt-2">
                                                Saving...
                                             </Text>
                                          )}
                                       </View>
                                    </View>
                                 </View>
                              );
                           })}
                        </View>
                     </View>
                  </View>
               )}
            </View>
         </View>
      </View>
   );
}
