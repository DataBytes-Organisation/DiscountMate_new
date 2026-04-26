import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import UserHubSidebar from "../../components/common/UserHubSidebar";
import { useUserProfile } from "../../context/UserProfileContext";
import {
   fetchSubscription,
   updateSubscription,
} from "../../services/subscription";
import {
   SubscriptionPlan,
   SubscriptionSummary,
} from "../../types/Subscription";
import { SESSION_EXPIRED_MESSAGE } from "../../utils/authSession";

const FALLBACK_SUBSCRIPTION: SubscriptionSummary = {
   currentPlan: "free",
   currentPlanLabel: "Free",
   currentPriceLabel: "$0",
   currentPriceSuffix: "forever",
   plans: [],
   usage: {
      priceAlerts: {
         label: "Price Alerts",
         used: 0,
         limit: 5,
      },
      savedLists: {
         label: "Saved Lists",
         used: 0,
         limit: 3,
      },
   },
};

function getDisplayName(firstName?: string, lastName?: string) {
   return `${firstName ?? ""} ${lastName ?? ""}`.trim() || "DiscountMate Member";
}

function formatUsageLabel(used: number, limit: number | null) {
   if (limit === null) {
      return `${used} / Unlimited`;
   }

   return `${used} / ${limit}`;
}

function getUsageRatio(used: number, limit: number | null) {
   if (limit === null || limit <= 0) {
      return 1;
   }

   return Math.min(1, used / limit);
}

function getPlanCardAccent(planKey: SubscriptionPlan["key"]) {
   switch (planKey) {
      case "premium":
         return {
            price: "text-emerald-500",
            button: "bg-primary_green",
            badgeBg: "bg-emerald-100",
            badgeText: "text-emerald-700",
         };
      case "family":
         return {
            price: "text-violet-500",
            button: "bg-violet-500",
            badgeBg: "bg-violet-100",
            badgeText: "text-violet-700",
         };
      default:
         return {
            price: "text-gray-700",
            button: "bg-gray-200",
            badgeBg: "bg-gray-100",
            badgeText: "text-gray-500",
         };
   }
}

const PLAN_ICONS: Record<SubscriptionPlan["key"], string> = {
   free: "star",
   premium: "gem",
   family: "users",
};

export default function SubscriptionScreen() {
   const router = useRouter();
   const { profile, setCachedProfile } = useUserProfile();
   const [subscription, setSubscription] =
      useState<SubscriptionSummary>(FALLBACK_SUBSCRIPTION);
   const [loading, setLoading] = useState(true);
   const [savingPlan, setSavingPlan] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [successMessage, setSuccessMessage] = useState<string | null>(null);

   useEffect(() => {
      let active = true;

      const loadSubscription = async () => {
         setLoading(true);
         setError(null);
         try {
            const data = await fetchSubscription();
            if (active) {
               setSubscription(data);
            }
         } catch (err: any) {
            if (active) {
               const message = err?.message || "Unable to load subscription.";
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

      loadSubscription();

      return () => {
         active = false;
      };
   }, []);

   const displayName = useMemo(
      () => getDisplayName(profile?.firstName, profile?.lastName),
      [profile?.firstName, profile?.lastName]
   );
   const membershipLabel = useMemo(() => {
      const plan = String(profile?.subscriptionPlan || subscription.currentPlan || "free");
      return `${plan.charAt(0).toUpperCase()}${plan.slice(1)} Member`;
   }, [profile?.subscriptionPlan, subscription.currentPlan]);

   const usageMetrics = [
      {
         ...subscription.usage.priceAlerts,
         color: "bg-emerald-500",
         textColor: "text-emerald-600",
      },
      {
         ...subscription.usage.savedLists,
         color: "bg-blue-500",
         textColor: "text-blue-600",
      },
   ];

   const handleSelectPlan = async (plan: SubscriptionPlan["key"]) => {
      if (plan === subscription.currentPlan) {
         return;
      }

      setSavingPlan(plan);
      setError(null);
      setSuccessMessage(null);

      try {
         const updated = await updateSubscription(plan);
         setSubscription(updated);
         setCachedProfile((current) =>
            current
               ? {
                    ...current,
                    subscriptionPlan: updated.currentPlan,
                 }
               : current
         );
         setSuccessMessage(`Your plan is now ${updated.currentPlanLabel}.`);
      } catch (err: any) {
         const message = err?.message || "Unable to update subscription.";
         setError(message);
         if (message === SESSION_EXPIRED_MESSAGE) {
            router.replace("/login");
         }
      } finally {
         setSavingPlan(null);
      }
   };

   return (
      <View className="flex-1 bg-[#F7F8F4]">
         <View className="flex-col lg:flex-row">
            <UserHubSidebar
               activeKey="subscription"
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
                        Loading your subscription...
                     </Text>
                  </View>
               ) : (
                  <View className="max-w-[1480px] w-full gap-4">
                     <View className="rounded-[28px] border border-gray-100 bg-white shadow-sm overflow-hidden">
                        <View className="flex-row items-start justify-between px-5 md:px-6 py-5 border-b border-gray-100">
                           <View>
                              <Text className="text-xs font-bold tracking-[0.18em] uppercase text-gray-400">
                                 Current Plan
                              </Text>
                              <Text className="mt-2 text-3xl font-bold text-gray-900">
                                 {subscription.currentPlanLabel}
                              </Text>
                              <Text className="mt-2 text-base text-gray-500">
                                 {subscription.currentPriceLabel}
                                 <Text className="text-sm"> {subscription.currentPriceSuffix}</Text>
                              </Text>
                           </View>
                           <View className="w-12 h-12 rounded-2xl bg-[#F8FAFC] items-center justify-center">
                              <FontAwesome6
                                 name={PLAN_ICONS[subscription.currentPlan]}
                                 size={18}
                                 color="#6B7280"
                              />
                           </View>
                        </View>

                        <View className="px-5 md:px-6 py-5">
                           <Text className="text-sm font-semibold text-gray-500 mb-5">
                              Your usage this month
                           </Text>
                           <View className="gap-4">
                              {usageMetrics.map((metric) => (
                                 <View key={metric.label}>
                                    <View className="flex-row items-center justify-between mb-2">
                                       <Text className="text-sm font-medium text-gray-700">
                                          {metric.label}
                                       </Text>
                                       <Text className={`text-sm font-semibold ${metric.textColor}`}>
                                          {formatUsageLabel(metric.used, metric.limit)}
                                       </Text>
                                    </View>
                                    <View className="h-2 rounded-full bg-gray-100 overflow-hidden">
                                       <View
                                          className={`h-full rounded-full ${metric.color}`}
                                          style={{
                                             width: `${getUsageRatio(metric.used, metric.limit) * 100}%`,
                                          }}
                                       />
                                    </View>
                                 </View>
                              ))}
                           </View>
                        </View>
                     </View>

                     <View>
                        <Text className="text-xs font-bold tracking-[0.18em] uppercase text-gray-400 mb-4">
                           Upgrade Your Plan
                        </Text>

                        <View className="flex-col xl:flex-row gap-4">
                           {subscription.plans.map((plan) => {
                              const accent = getPlanCardAccent(plan.key);
                              const isCurrent = plan.current;
                              const isSaving = savingPlan === plan.key;

                              return (
                                 <View
                                    key={plan.key}
                                    className={`flex-1 rounded-[28px] border bg-white p-5 shadow-sm ${
                                       isCurrent
                                          ? "border-gray-300"
                                          : "border-gray-100"
                                    }`}
                                 >
                                    <View className="min-h-[340px]">
                                       <View className="flex-row items-center justify-between">
                                          <Text className="text-2xl font-bold text-gray-900">
                                             {plan.label}
                                          </Text>
                                          {plan.badge ? (
                                             <View className={`rounded-full px-3 py-1 ${accent.badgeBg}`}>
                                                <Text className={`text-xs font-semibold ${accent.badgeText}`}>
                                                   {plan.badge}
                                                </Text>
                                             </View>
                                          ) : (
                                             <View className="w-10 h-10 rounded-2xl bg-[#F8FAFC] items-center justify-center">
                                                <FontAwesome6
                                                   name={PLAN_ICONS[plan.key]}
                                                   size={16}
                                                   color={plan.key === "family" ? "#8B5CF6" : plan.key === "premium" ? "#10B981" : "#6B7280"}
                                                />
                                             </View>
                                          )}
                                       </View>

                                       <View className="mt-4 flex-row items-end gap-2">
                                          <Text className={`text-4xl font-bold ${accent.price}`}>
                                             {plan.priceLabel}
                                          </Text>
                                          <Text className="text-sm text-gray-400 mb-1">
                                             {plan.priceSuffix}
                                          </Text>
                                       </View>

                                       <View className="mt-6 gap-4">
                                          {plan.features.map((feature) => (
                                             <View
                                                key={feature}
                                                className="flex-row items-start gap-3"
                                             >
                                                <FontAwesome6
                                                   name={
                                                      plan.key === "family"
                                                         ? "wand-sparkles"
                                                         : plan.key === "premium"
                                                            ? "bolt"
                                                            : "tag"
                                                   }
                                                   size={14}
                                                   color={
                                                      plan.key === "family"
                                                         ? "#8B5CF6"
                                                         : plan.key === "premium"
                                                            ? "#10B981"
                                                            : "#6B7280"
                                                   }
                                                   style={{ marginTop: 4 }}
                                                />
                                                <Text className="flex-1 text-sm leading-6 text-gray-500">
                                                   {feature}
                                                </Text>
                                             </View>
                                          ))}
                                       </View>
                                    </View>

                                    <Pressable
                                       onPress={() => handleSelectPlan(plan.key)}
                                       disabled={isCurrent || isSaving}
                                       className={`mt-6 rounded-2xl py-4 items-center justify-center ${
                                          isCurrent
                                             ? "bg-gray-100"
                                             : accent.button
                                       }`}
                                    >
                                       <Text
                                          className={`text-base font-semibold ${
                                             isCurrent ? "text-gray-500" : "text-white"
                                          }`}
                                       >
                                          {isCurrent
                                             ? "Current Plan"
                                             : isSaving
                                                ? "Updating..."
                                                : "Upgrade Now"}
                                       </Text>
                                    </Pressable>
                                 </View>
                              );
                           })}
                        </View>

                        <Text className="mt-5 text-center text-sm text-gray-400">
                           All plans are billed monthly. Cancel any time. No lock-in contract.
                        </Text>
                     </View>
                  </View>
               )}
            </View>
         </View>
      </View>
   );
}
