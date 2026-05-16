import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "react-native-vector-icons/Ionicons";
import UserHubSidebar from "../../components/common/UserHubSidebar";
import { useUserProfile } from "../../context/UserProfileContext";
import { useNotificationCenter } from "../../context/NotificationCenterContext";
import {
   fetchAlertSegments,
   updateAlertSegment,
} from "../../services/alertSegments";
import {
   AlertSegment,
   AlertSegmentsResponse,
} from "../../types/AlertSegments";
import { SESSION_EXPIRED_MESSAGE } from "../../utils/authSession";

const FALLBACK_RESPONSE: AlertSegmentsResponse = {
   summary: {
      totalCategories: 19,
      activeCategories: 0,
      triggeredCategories: 0,
   },
   segments: [],
};

const ICON_BY_CATEGORY: Record<string, { icon: string; tint: string; bg: string }> = {
   alcohol: { icon: "wine-outline", tint: "#9333EA", bg: "#F3E8FF" },
   "baby-food-accessories": { icon: "happy-outline", tint: "#EC4899", bg: "#FCE7F3" },
   bakery: { icon: "restaurant-outline", tint: "#D97706", bg: "#FEF3C7" },
   beverages: { icon: "cafe-outline", tint: "#2563EB", bg: "#DBEAFE" },
   continental: { icon: "globe-outline", tint: "#0F766E", bg: "#CCFBF1" },
   "convenience-food": { icon: "fast-food-outline", tint: "#EA580C", bg: "#FFEDD5" },
   "dairy-refrigerated": { icon: "snow-outline", tint: "#0284C7", bg: "#E0F2FE" },
   "deli-chilled-meals": { icon: "pizza-outline", tint: "#DB2777", bg: "#FCE7F3" },
   "frozen-foods": { icon: "cube-outline", tint: "#06B6D4", bg: "#CFFAFE" },
   "fruit-veg-produce": { icon: "leaf-outline", tint: "#16A34A", bg: "#DCFCE7" },
   "health-beauty": { icon: "sparkles-outline", tint: "#C026D3", bg: "#FAE8FF" },
   "health-food-supplements": { icon: "fitness-outline", tint: "#0891B2", bg: "#CFFAFE" },
   "household-items": { icon: "home-outline", tint: "#4B5563", bg: "#F3F4F6" },
   miscellaneous: { icon: "apps-outline", tint: "#6366F1", bg: "#E0E7FF" },
   pantry: { icon: "basket-outline", tint: "#92400E", bg: "#FEF3C7" },
   "pet-food-accessories": { icon: "paw-outline", tint: "#CA8A04", bg: "#FEF9C3" },
   "poultry-meat-seafood": { icon: "fish-outline", tint: "#DC2626", bg: "#FEE2E2" },
   seasonal: { icon: "sunny-outline", tint: "#F59E0B", bg: "#FEF3C7" },
   "snacks-confectionary": { icon: "ice-cream-outline", tint: "#A855F7", bg: "#F3E8FF" },
};

function getDisplayName(firstName?: string, lastName?: string) {
   return `${firstName ?? ""} ${lastName ?? ""}`.trim() || "DiscountMate Member";
}

function getIconConfig(categoryKey: string) {
   return (
      ICON_BY_CATEGORY[categoryKey] || {
         icon: "pricetag-outline",
         tint: "#10B981",
         bg: "#D1FAE5",
      }
   );
}

function buildSummaryFromSegments(segments: AlertSegment[]) {
   return {
      totalCategories: segments.length,
      activeCategories: segments.filter((segment) => segment.active).length,
      triggeredCategories: segments.filter((segment) => segment.triggeredCount > 0).length,
   };
}

export default function AlertSegmentsScreen() {
   const router = useRouter();
   const { profile } = useUserProfile();
   const { refreshNotifications } = useNotificationCenter();
   const [data, setData] = useState<AlertSegmentsResponse>(FALLBACK_RESPONSE);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [successMessage, setSuccessMessage] = useState<string | null>(null);
   const [savingKey, setSavingKey] = useState<string | null>(null);

   useEffect(() => {
      let active = true;

      const loadAlertSegments = async () => {
         setLoading(true);
         setError(null);

         try {
            const response = await fetchAlertSegments();
            if (active) {
               setData(response);
            }
            await refreshNotifications();
         } catch (err: any) {
            if (active) {
               const message = err?.message || "Unable to load alert segments.";
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

      loadAlertSegments();

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

   const handleToggle = async (segment: AlertSegment) => {
      const previousData = data;
      const nextSegments = data.segments.map((currentSegment) =>
         currentSegment.categoryKey === segment.categoryKey
            ? { ...currentSegment, active: !currentSegment.active }
            : currentSegment
      );

      setData({
         summary: buildSummaryFromSegments(nextSegments),
         segments: nextSegments,
      });
      setSavingKey(segment.categoryKey);
      setError(null);
      setSuccessMessage(null);

      try {
         const savedSegment = await updateAlertSegment(
            segment.categoryKey,
            !segment.active
         );
         const mergedSegments = nextSegments.map((currentSegment) =>
            currentSegment.categoryKey === savedSegment.categoryKey
               ? savedSegment
               : currentSegment
         );
         setData({
            summary: buildSummaryFromSegments(mergedSegments),
            segments: mergedSegments,
         });
         setSuccessMessage("Alert segments updated.");
         await refreshNotifications();
      } catch (err: any) {
         const message = err?.message || "Unable to update alert segment.";
         setData(previousData);
         setError(message);
         if (message === SESSION_EXPIRED_MESSAGE) {
            router.replace("/login");
         }
      } finally {
         setSavingKey(null);
      }
   };

   const summaryCards = [
      {
         label: "Available Categories",
         value: String(data.summary.totalCategories),
         bg: "bg-white",
         border: "border-gray-100",
         accent: "text-gray-900",
      },
      {
         label: "Active",
         value: String(data.summary.activeCategories),
         bg: "bg-emerald-50",
         border: "border-emerald-100",
         accent: "text-emerald-600",
      },
      {
         label: "Triggered",
         value: String(data.summary.triggeredCategories),
         bg: "bg-amber-50",
         border: "border-amber-100",
         accent: "text-amber-600",
      },
   ];

   return (
      <View className="flex-1 bg-[#F7F8F4]">
         <View className="flex-col lg:flex-row">
            <UserHubSidebar
               activeKey="alerts"
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
                        Loading your alert segments...
                     </Text>
                  </View>
               ) : (
                  <View className="max-w-[1480px] w-full gap-4">
                     <View className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
                        <Text className="text-2xl font-bold text-gray-900">
                           Manage Alert Segments
                        </Text>
                        <Text className="mt-2 text-sm text-gray-500 leading-6">
                           Turn on category alerts to hear about discounted products and
                           specials in the groups you care about most.
                        </Text>
                     </View>

                     <View className="flex-col md:flex-row gap-4">
                        {summaryCards.map((card) => (
                           <View
                              key={card.label}
                              className={`flex-1 rounded-[24px] border ${card.border} ${card.bg} px-5 py-5 min-h-[112px] justify-center`}
                           >
                              <Text className={`text-3xl font-bold ${card.accent}`}>
                                 {card.value}
                              </Text>
                              <Text className="mt-2 text-sm font-medium text-gray-500">
                                 {card.label}
                              </Text>
                           </View>
                        ))}
                     </View>

                     <View className="gap-3">
                        {data.segments.map((segment) => {
                           const iconConfig = getIconConfig(segment.categoryKey);
                           const isSaving = savingKey === segment.categoryKey;

                           return (
                              <View
                                 key={segment.categoryKey}
                                 className="rounded-[24px] border border-gray-100 bg-white px-4 md:px-5 py-4 shadow-sm"
                              >
                                 <View className="flex-row items-center gap-3">
                                    <View
                                       className="w-12 h-12 rounded-2xl items-center justify-center"
                                       style={{ backgroundColor: iconConfig.bg }}
                                    >
                                       <Ionicons
                                          name={iconConfig.icon}
                                          size={22}
                                          color={iconConfig.tint}
                                       />
                                    </View>

                                    <View className="flex-1 pr-3">
                                       <Text className="text-base font-semibold text-gray-900">
                                          {segment.categoryLabel}
                                       </Text>
                                       <Text className="mt-1 text-sm text-gray-500 leading-5">
                                          {segment.triggeredCount > 0
                                             ? `${segment.triggeredCount} active alert${segment.triggeredCount === 1 ? "" : "s"} ready in your bell panel`
                                             : segment.active
                                                ? "Watching this category for new specials and discounts."
                                                : "No active alerts for this category yet."}
                                       </Text>
                                    </View>

                                    <View className="items-end gap-2">
                                       {segment.triggeredCount > 0 && (
                                          <View className="rounded-full bg-amber-100 px-3 py-1">
                                             <Text className="text-xs font-semibold text-amber-700">
                                                {segment.triggeredCount} new
                                             </Text>
                                          </View>
                                       )}
                                       <Switch
                                          value={segment.active}
                                          onValueChange={() => handleToggle(segment)}
                                          disabled={isSaving}
                                          trackColor={{
                                             false: "#E5E7EB",
                                             true: "#10B981",
                                          }}
                                          thumbColor="#FFFFFF"
                                       />
                                       {isSaving && (
                                          <Text className="text-xs text-gray-400">
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
               )}
            </View>
         </View>
      </View>
   );
}
