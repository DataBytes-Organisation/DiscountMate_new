import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "expo-router";
import Svg, {
   Defs,
   LinearGradient as SvgGradient,
   Stop,
   Polyline,
   Line,
   Circle,
} from "react-native-svg";
import UserHubSidebar from "../../components/common/UserHubSidebar";
import {
   fetchDashboardPreferences,
   fetchDashboardSummary,
   repriceDashboardLists,
   updateDashboardPreferences,
} from "../../services/dashboard";
import { fetchSavedLists } from "../../services/lists";
import { DashboardRangeKey, DashboardSummary } from "../../types/DashboardSummary";
import {
   DashboardRetailerKey,
   SavedListSummary,
} from "../../types/SavedList";
import { SESSION_EXPIRED_MESSAGE } from "../../utils/authSession";

const FALLBACK_SUMMARY: DashboardSummary = {
   user: {
      displayName: "DiscountMate Member",
      email: "",
      membershipLabel: "Free Plan",
      profileCompletion: 0,
   },
   range: {
      key: "1y",
      label: "This Year",
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      historicalDataAvailable: false,
   },
   selectedList: null,
   metrics: {
      totalSaved: 0,
      totalSpent: 0,
      activeAlerts: 0,
      unreadNotifications: 0,
      shoppingLists: 0,
      savingsRate: 0,
   },
   trend: {
      labels: [],
      spent: [],
      saved: [],
   },
   recentSnapshots: [],
   highlights: {
      subscriptionPlan: "Free",
      reportUpdatedAt: new Date().toISOString(),
   },
};

function formatCurrency(value: number): string {
   return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
   }).format(value || 0);
}

function buildPolyline(
   points: number[],
   chartWidth: number,
   graphTop: number,
   graphBottom: number,
   minPoint: number,
   pointRange: number
) {
   if (!points.length) {
      return "";
   }

   return points
      .map((point, index) => {
         const x =
            points.length === 1
               ? chartWidth / 2
               : 30 + (index * (chartWidth - 60)) / (points.length - 1);
         const y =
            graphBottom - ((point - minPoint) / pointRange) * (graphBottom - graphTop);
         return `${x},${y}`;
      })
      .join(" ");
}

export default function DashboardScreen() {
   const router = useRouter();
   const [summary, setSummary] = useState<DashboardSummary>(FALLBACK_SUMMARY);
   const [savedLists, setSavedLists] = useState<SavedListSummary[]>([]);
   const [selectedRange, setSelectedRange] = useState<DashboardRangeKey>("1y");
   const [selectedListId, setSelectedListId] = useState("");
   const [selectedRetailer, setSelectedRetailer] =
      useState<DashboardRetailerKey>("coles");
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const loadDashboard = async (range = selectedRange, showLoader = true) => {
      if (showLoader) {
         setLoading(true);
      }
      setError(null);

      try {
         const [summaryData, lists, preferences] = await Promise.all([
            fetchDashboardSummary(range),
            fetchSavedLists(),
            fetchDashboardPreferences(),
         ]);

         setSummary(summaryData);
         setSavedLists(lists);
         setSelectedListId(
            preferences.selectedDashboardListId ||
               summaryData.selectedList?.id ||
               lists[0]?.id ||
               ""
         );
         setSelectedRetailer(
            preferences.selectedDashboardRetailer ||
               summaryData.selectedList?.selectedRetailer ||
               "coles"
         );
      } catch (err: any) {
         const message = err?.message || "Unable to load dashboard.";
         setError(message);
         if (message === SESSION_EXPIRED_MESSAGE) {
            router.replace("/login");
         }
      } finally {
         if (showLoader) {
            setLoading(false);
         }
      }
   };

   useEffect(() => {
      loadDashboard(selectedRange, true);
   }, [selectedRange]);

   const reportUpdatedAt = useMemo(() => {
      if (!summary.highlights.reportUpdatedAt) {
         return "Unavailable";
      }

      return new Date(summary.highlights.reportUpdatedAt).toLocaleDateString("en-AU", {
         day: "numeric",
         month: "short",
         year: "numeric",
      });
   }, [summary.highlights.reportUpdatedAt]);

   const rangeLabel = useMemo(() => {
      switch (selectedRange) {
         case "30d":
            return "Last 30 days";
         case "90d":
            return "Last 3 months";
         default:
            return "This year";
      }
   }, [selectedRange]);

   const selectedListName =
      savedLists.find((list) => list.id === selectedListId)?.name ||
      summary.selectedList?.name ||
      "Choose a list";

   const primaryStats = [
      {
         icon: "chart-line",
         label: "Total Saved",
         value: formatCurrency(summary.metrics.totalSaved),
         helper: summary.selectedList ? "Potential savings" : "Selected list summary",
         accent: "text-white",
         bg: "bg-primary_green",
         iconBg: "bg-white/15",
         border: "border-primary_green",
      },
      {
         icon: "wallet",
         label: "Total Spent",
         value: formatCurrency(summary.metrics.totalSpent),
         helper:
            summary.metrics.shoppingLists > 1
               ? `${summary.metrics.shoppingLists} grocery lists`
               : summary.selectedList
                 ? selectedListName
                 : "Create a grocery list",
         accent: "text-gray-900",
         bg: "bg-white",
         iconBg: "bg-blue-50",
         border: "border-gray-100",
      },
      {
         icon: "percent",
         label: "Savings Rate",
         value: `${summary.metrics.savingsRate.toFixed(1)}%`,
         helper: summary.selectedList
            ? "vs highest comparable retailer"
            : "Retailer comparison",
         accent: "text-gray-900",
         bg: "bg-white",
         iconBg: "bg-amber-50",
         border: "border-gray-100",
      },
      {
         icon: "list-check",
         label: "Saved Lists",
         value: String(summary.metrics.shoppingLists),
         helper: "Available for dashboard",
         accent: "text-gray-900",
         bg: "bg-white",
         iconBg: "bg-violet-50",
         border: "border-gray-100",
      },
   ];

   const trendLabels = summary.trend.labels;
   const chartWidth = 980;
   const chartHeight = 220;
   const graphTop = 30;
   const graphBottom = 190;
   const combinedPoints = [...summary.trend.spent, ...summary.trend.saved];
   const minPoint = combinedPoints.length ? Math.min(...combinedPoints) : 0;
   const maxPoint = combinedPoints.length ? Math.max(...combinedPoints) : 0;
   const pointRange = Math.max(maxPoint - minPoint, 1);
   const spentPolyline = buildPolyline(
      summary.trend.spent,
      chartWidth,
      graphTop,
      graphBottom,
      minPoint,
      pointRange
   );
   const savedPolyline = buildPolyline(
      summary.trend.saved,
      chartWidth,
      graphTop,
      graphBottom,
      minPoint,
      pointRange
   );
   const hasComparableTrendData =
      summary.metrics.totalSaved > 0 ||
      summary.trend.saved.some((value) => value > 0) ||
      summary.recentSnapshots.some(
         (snapshot) => snapshot.comparisonStatus === "comparable"
      );

   const handleApplySelection = async () => {
      if (!selectedListId) {
         setError("Choose a saved list before applying it to the dashboard.");
         return;
      }

      setRefreshing(true);
      setError(null);

      try {
         await updateDashboardPreferences({
            selectedDashboardListId: selectedListId,
            selectedDashboardRetailer: selectedRetailer,
         });
         await repriceDashboardLists(selectedRetailer);
         await loadDashboard(selectedRange, false);
      } catch (err: any) {
         const message = err?.message || "Unable to apply dashboard list selection.";
         setError(message);
         if (message === SESSION_EXPIRED_MESSAGE) {
            router.replace("/login");
         }
      } finally {
         setRefreshing(false);
      }
   };

   const handleRefreshPricing = async () => {
      if (!summary.metrics.shoppingLists) {
         return;
      }

      setRefreshing(true);
      setError(null);

      try {
         await repriceDashboardLists(
            summary.selectedList?.selectedRetailer || selectedRetailer
         );
         await loadDashboard(selectedRange, false);
      } catch (err: any) {
         const message = err?.message || "Unable to refresh dashboard pricing.";
         setError(message);
         if (message === SESSION_EXPIRED_MESSAGE) {
            router.replace("/login");
         }
      } finally {
         setRefreshing(false);
      }
   };

   return (
      <View className="flex-1 bg-[#F7F8F4]">
         <View className="flex-col xl:flex-row">
            <UserHubSidebar
               activeKey="dashboard"
               displayName={summary.user.displayName}
               email={summary.user.email}
               membershipLabel={summary.user.membershipLabel}
            />

            <View className="flex-1 px-4 py-4 md:px-6">
               {error && (
                  <View className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                     <Text className="text-sm text-red-700">{error}</Text>
                  </View>
               )}

               {loading ? (
                  <View className="flex-row items-center gap-3 rounded-3xl border border-gray-100 bg-white px-5 py-8">
                     <ActivityIndicator color="#10B981" />
                     <Text className="text-gray-700">Loading dashboard summary...</Text>
                  </View>
               ) : (
                  <>
                     <View className="mb-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                        <View className="flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                           <View>
                              <Text className="text-2xl font-bold text-gray-900">
                                 Dashboard
                              </Text>
                              <Text className="mt-1 text-sm text-gray-500">
                                 Real spending and savings from your grocery lists,
                                 backed by persisted retailer pricing snapshots.
                              </Text>
                           </View>
                           <View className="flex-col items-start gap-2 lg:items-end">
                              <View className="flex-row items-center gap-2">
                                 <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                                 <Text className="text-sm text-gray-500">
                                    Report updated{" "}
                                    <Text className="font-semibold text-gray-700">
                                       {reportUpdatedAt}
                                    </Text>
                                 </Text>
                              </View>
                              <View className="flex-row flex-wrap gap-3">
                                 {summary.selectedList && (
                                    <Pressable
                                       onPress={handleRefreshPricing}
                                       disabled={refreshing}
                                       className={`rounded-2xl px-5 py-3 ${
                                          refreshing
                                             ? "bg-emerald-100"
                                             : "bg-emerald-50 active:bg-emerald-100"
                                       }`}
                                    >
                                       <Text className="font-semibold text-primary_green">
                                          {refreshing
                                             ? "Refreshing..."
                                             : "Refresh grocery list pricing"}
                                       </Text>
                                    </Pressable>
                                 )}
                                 <Pressable
                                    onPress={() => router.push("/(tabs)/product-dashboard")}
                                    className="flex-row items-center gap-2 rounded-2xl bg-primary_green px-5 py-3 shadow-sm"
                                 >
                                    <Ionicons name="open-outline" size={18} color="#FFFFFF" />
                                    <Text className="font-semibold text-white">
                                       View full dashboard report
                                    </Text>
                                 </Pressable>
                              </View>
                           </View>
                        </View>

                        <View className="mt-4 flex-row flex-wrap gap-3">
                           {[
                              {
                                 label: "Unread notifications",
                                 value: summary.metrics.unreadNotifications,
                              },
                              {
                                 label: "Active alerts",
                                 value: summary.metrics.activeAlerts,
                              },
                              {
                                 label: "Saved lists",
                                 value: summary.metrics.shoppingLists,
                              },
                              {
                                 label: "Plan",
                                 value: summary.highlights.subscriptionPlan,
                              },
                           ].map((item) => (
                              <View
                                 key={item.label}
                                 className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2"
                              >
                                 <Text className="text-xs font-semibold text-primary_green">
                                    {item.label}:{" "}
                                    <Text className="text-emerald-800">{item.value}</Text>
                                 </Text>
                              </View>
                           ))}
                        </View>
                     </View>

                     <View className="mb-4 flex-row flex-wrap -mx-2">
                        {primaryStats.map((stat) => (
                           <View
                              key={stat.label}
                              className="mb-4 w-full px-2 md:w-1/2 xl:w-1/4"
                           >
                              <View
                                 className={`${stat.bg} min-h-[142px] rounded-3xl border ${stat.border} p-5 shadow-sm`}
                              >
                                 <View
                                    className={`mb-4 h-12 w-12 items-center justify-center rounded-2xl ${stat.iconBg}`}
                                 >
                                    <FontAwesome6
                                       name={stat.icon}
                                       size={18}
                                       color={stat.label === "Total Saved" ? "#FFFFFF" : "#111827"}
                                    />
                                 </View>
                                 <Text className={`text-3xl font-bold ${stat.accent}`}>
                                    {stat.value}
                                 </Text>
                                 <Text
                                    className={`mt-2 text-sm ${
                                       stat.label === "Total Saved"
                                          ? "text-white/80"
                                          : "text-gray-500"
                                    }`}
                                 >
                                    {stat.label}
                                 </Text>
                                 <Text
                                    className={`mt-1 text-sm ${
                                       stat.label === "Total Saved"
                                          ? "text-white/70"
                                          : "text-gray-400"
                                    }`}
                                 >
                                    {stat.helper}
                                 </Text>
                              </View>
                           </View>
                        ))}
                     </View>

                     <View className="mb-4 flex-row items-center gap-3 rounded-3xl border border-gray-100 bg-white p-3">
                        {[
                           { key: "30d" as DashboardRangeKey, label: "30 Days" },
                           { key: "90d" as DashboardRangeKey, label: "3 Months" },
                           { key: "1y" as DashboardRangeKey, label: "This Year" },
                        ].map((item) => {
                           const isActive = selectedRange === item.key;
                           return (
                              <Pressable
                                 key={item.key}
                                 onPress={() => setSelectedRange(item.key)}
                                 className={`flex-1 items-center rounded-full py-2 ${
                                    isActive ? "bg-primary_green" : ""
                                 }`}
                              >
                                 <Text
                                    className={`${isActive ? "text-white" : "text-gray-500"} font-semibold`}
                                 >
                                    {item.label}
                                 </Text>
                              </Pressable>
                           );
                        })}
                     </View>

                     <View className="mb-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                        <View className="mb-6 flex-col gap-4 md:flex-row md:items-start md:justify-between">
                           <View>
                              <Text className="text-2xl font-bold text-gray-900">
                                 Spending & Savings
                              </Text>
                              <Text className="mt-1 text-sm text-gray-500">
                                 {rangeLabel} snapshot history from your grocery lists
                              </Text>
                           </View>
                        </View>

                        <View className="rounded-[28px] border border-emerald-50 bg-[#F9FCFB] p-4">
                           {summary.selectedList &&
                           summary.range.historicalDataAvailable &&
                           (summary.trend.spent.length > 0 ||
                              summary.trend.saved.length > 0) ? (
                              <>
                                 <Svg
                                    width="100%"
                                    height={260}
                                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                                 >
                                    <Defs>
                                       <SvgGradient
                                          id="savedAreaGradient"
                                          x1="0%"
                                          y1="0%"
                                          x2="0%"
                                          y2="100%"
                                       >
                                          <Stop
                                             offset="0%"
                                             stopColor="#10B981"
                                             stopOpacity="0.18"
                                          />
                                          <Stop
                                             offset="100%"
                                             stopColor="#10B981"
                                             stopOpacity="0.04"
                                          />
                                       </SvgGradient>
                                    </Defs>

                                    {[0, 1, 2, 3].map((lineIndex) => {
                                       const y =
                                          graphTop +
                                          (lineIndex * (graphBottom - graphTop)) / 3;
                                       return (
                                          <Line
                                             key={lineIndex}
                                             x1="24"
                                             y1={y}
                                             x2={chartWidth - 24}
                                             y2={y}
                                             stroke="#DDE8E2"
                                             strokeWidth="1"
                                             strokeDasharray="5 6"
                                          />
                                       );
                                    })}

                                    {hasComparableTrendData && savedPolyline ? (
                                       <Polyline
                                          points={`${savedPolyline} ${chartWidth - 30},${graphBottom} 30,${graphBottom}`}
                                          fill="url(#savedAreaGradient)"
                                          stroke="none"
                                       />
                                    ) : null}

                                    {spentPolyline ? (
                                       <Polyline
                                          points={spentPolyline}
                                          fill="none"
                                          stroke="#3B82F6"
                                          strokeWidth="3"
                                          strokeLinejoin="round"
                                          strokeLinecap="round"
                                       />
                                    ) : null}

                                    {hasComparableTrendData && savedPolyline ? (
                                       <Polyline
                                          points={savedPolyline}
                                          fill="none"
                                          stroke="#10B981"
                                          strokeWidth="4"
                                          strokeLinejoin="round"
                                          strokeLinecap="round"
                                       />
                                    ) : null}

                                    {hasComparableTrendData &&
                                       summary.trend.saved.map((point, index) => {
                                       const x =
                                          summary.trend.saved.length === 1
                                             ? chartWidth / 2
                                             : 30 +
                                               (index * (chartWidth - 60)) /
                                                  (summary.trend.saved.length - 1);
                                       const y =
                                          graphBottom -
                                          ((point - minPoint) / pointRange) *
                                             (graphBottom - graphTop);

                                       return (
                                          <Circle
                                             key={`saved-point-${trendLabels[index]}`}
                                             cx={x}
                                             cy={y}
                                             r="5"
                                             fill="#10B981"
                                             stroke="#FFFFFF"
                                             strokeWidth="3"
                                          />
                                       );
                                    })}
                                 </Svg>

                                 <View className="mt-2 flex-row justify-between px-2">
                                    {trendLabels.map((label) => (
                                       <Text key={label} className="text-xs text-gray-400">
                                          {label}
                                       </Text>
                                    ))}
                                 </View>
                                 <View className="mt-4 flex-row items-center justify-center gap-6">
                                    <View className="flex-row items-center gap-2">
                                       <View className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />
                                       <Text className="text-sm text-gray-500">Spent</Text>
                                    </View>
                                    {hasComparableTrendData ? (
                                       <View className="flex-row items-center gap-2">
                                          <View className="h-2.5 w-2.5 rounded-full bg-primary_green" />
                                          <Text className="text-sm text-gray-500">Saved</Text>
                                       </View>
                                    ) : null}
                                 </View>
                                 {!hasComparableTrendData ? (
                                    <Text className="mt-3 text-center text-xs text-gray-400">
                                       Savings trend will appear when at least one grocery
                                       list has comparable retailer pricing.
                                    </Text>
                                 ) : null}
                              </>
                           ) : (
                              <View className="min-h-[260px] items-center justify-center px-6">
                                 <Ionicons
                                    name="analytics-outline"
                                    size={34}
                                    color="#9CA3AF"
                                 />
                                 <Text className="mt-4 text-center text-lg font-semibold text-gray-700">
                                    No historical pricing snapshots yet
                                 </Text>
                                 <Text className="mt-2 text-center text-sm leading-6 text-gray-500">
                                    Refresh your grocery list pricing to
                                    create the first real dashboard history for 30 days, 3
                                    months, and this year.
                                 </Text>
                              </View>
                           )}
                        </View>
                     </View>

                     <View className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                        <Text className="text-2xl font-bold text-gray-900">
                           Recent list snapshots
                        </Text>
                        <Text className="mt-1 text-sm text-gray-500">
                           Most recent pricing snapshots from your grocery lists.
                        </Text>

                        {summary.recentSnapshots.length === 0 ? (
                           <View className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-[#FAFAF7] px-5 py-8">
                              <Text className="text-sm text-gray-500">
                                 No pricing snapshots have been saved for this range yet.
                              </Text>
                           </View>
                        ) : (
                           <View className="mt-5 gap-3">
                              {summary.recentSnapshots.map((snapshot) => (
                                 <View
                                    key={snapshot.id}
                                    className="flex-col gap-3 rounded-2xl border border-gray-100 bg-[#FAFAF7] px-4 py-4 md:flex-row md:items-center md:justify-between"
                                 >
                                    <View className="flex-1">
                                       <Text className="font-semibold text-gray-900">
                                          {snapshot.listName}
                                       </Text>
                                       <Text className="mt-1 text-sm text-gray-500">
                                          {snapshot.date} ·{" "}
                                          {snapshot.comparisonLabel ||
                                             "Cheapest vs highest retailer"}
                                       </Text>
                                       {snapshot.comparisonStatus === "comparable" &&
                                       snapshot.cheapestRetailer &&
                                       snapshot.highestRetailer ? (
                                             <Text className="mt-1 text-xs text-gray-400">
                                                Cheapest {snapshot.cheapestRetailer}{" "}
                                                {formatCurrency(
                                                   snapshot.cheapestTotal || 0
                                                )}{" "}
                                                · Highest {snapshot.highestRetailer}{" "}
                                                {formatCurrency(
                                                   snapshot.highestTotal || 0
                                                )}
                                             </Text>
                                          ) : snapshot.comparisonStatus ===
                                            "comparable" ? (
                                             <Text className="mt-1 text-xs text-gray-400">
                                                Based on item-level comparable prices across
                                                available stores
                                             </Text>
                                          ) : (
                                             <Text className="mt-1 text-xs text-gray-400">
                                                No comparable retailer data yet
                                             </Text>
                                          )}
                                    </View>
                                    <View className="flex-row flex-wrap gap-4">
                                       <Text className="text-sm font-semibold text-gray-700">
                                          Spend {formatCurrency(snapshot.selectedTotal)}
                                       </Text>
                                       {snapshot.comparisonStatus === "comparable" ? (
                                          <Text className="text-sm font-semibold text-primary_green">
                                             Potential save {formatCurrency(snapshot.totalSaved)}
                                          </Text>
                                       ) : (
                                          <Text className="text-sm font-semibold text-gray-400">
                                             No comparable retailer data yet
                                          </Text>
                                       )}
                                    </View>
                                 </View>
                              ))}
                           </View>
                        )}
                     </View>
                  </>
               )}
            </View>
         </View>
      </View>
   );
}
