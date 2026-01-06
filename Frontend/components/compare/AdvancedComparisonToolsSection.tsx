import React from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { Svg, Path } from "react-native-svg";

export default function AdvancedComparisonToolsSection() {
   const budget = {
      weeklyBudget: 150,
      spent: 97.5,
      remaining: 52.5,
      avgWeekly: 142.3,
      savedThisMonth: 48.2,
   };

   const analytics = {
      topCategory: "Dairy & Eggs",
      mostSavedAt: "Aldi",
      bestDay: "Wednesday",
      avgBasket: 87.4,
      savingsRate: 24,
   };

   const progressPct = Math.min(100, Math.max(0, (budget.spent / budget.weeklyBudget) * 100));

   return (
      <View className="px-4 md:px-8 py-10 bg-[#F9FAFB]">
         <View className="w-full">
            {/* Header */}
            <View className="mb-8">
               <Text className="text-3xl font-bold text-gray-900 mb-2">
                  Advanced Comparison Tools
               </Text>
               <Text className="text-base text-gray-600">
                  Professional-grade features for serious savers
               </Text>
            </View>

            <View className="flex-row flex-wrap gap-6">
               {/* Weekly Budget Planner */}
               <View className="flex-1 min-w-[360px] rounded-3xl border border-blue-200 bg-blue-50/40 p-7 shadow-sm">
                  <View className="flex-row items-start gap-4 mb-6">
                     <View className="w-14 h-14 rounded-2xl bg-blue-600 items-center justify-center shadow-sm">
                        <FontAwesome6 name="calendar-days" size={20} color="#FFFFFF" />
                     </View>

                     <View className="flex-1">
                        <Text className="text-2xl font-bold text-gray-900 mb-1">
                           Weekly Budget Planner
                        </Text>
                        <Text className="text-sm text-gray-600">
                           Set weekly budgets and track spending across retailers
                        </Text>
                     </View>
                  </View>

                  {/* Budget row */}
                  <View className="flex-row items-center justify-between mb-3">
                     <Text className="text-sm font-semibold text-gray-800">This week&apos;s budget</Text>
                     <Text className="text-sm font-bold text-gray-900">
                        ${budget.weeklyBudget.toFixed(2)}
                     </Text>
                  </View>

                  {/* Progress bar */}
                  <View className="mb-2">
                     <View className="h-3 rounded-full bg-gray-200 overflow-hidden">
                        <View
                           className="h-3 rounded-full bg-blue-600"
                           style={{ width: `${progressPct}%` }}
                        />
                     </View>
                  </View>

                  <View className="flex-row items-center justify-between mb-6">
                     <Text className="text-sm text-gray-600">${budget.spent.toFixed(2)} spent</Text>
                     <Text className="text-sm font-semibold text-primary_green">
                        ${budget.remaining.toFixed(2)} remaining
                     </Text>
                  </View>

                  {/* Stat tiles */}
                  <View className="flex-row gap-4 mb-6">
                     <View className="flex-1 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                        <Text className="text-sm font-semibold text-gray-600 mb-2">Avg. weekly</Text>
                        <Text className="text-2xl font-bold text-gray-900">
                           ${budget.avgWeekly.toFixed(2)}
                        </Text>
                     </View>

                     <View className="flex-1 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                        <Text className="text-sm font-semibold text-gray-600 mb-2">Saved this month</Text>
                        <Text className="text-2xl font-bold text-primary_green">
                           ${budget.savedThisMonth.toFixed(2)}
                        </Text>
                     </View>
                  </View>

                  {/* CTA */}
                  <Pressable className="w-full py-4 rounded-2xl bg-blue-600 shadow-sm">
                     <Text className="text-white text-center font-semibold">View Budget Details</Text>
                  </Pressable>
               </View>

               {/* Spending Analytics */}
               <View className="flex-1 min-w-[360px] rounded-3xl border border-purple-200 bg-purple-50/40 p-7 shadow-sm">
                  <View className="flex-row items-start gap-4 mb-6">
                     <View className="w-14 h-14 rounded-2xl bg-purple-700 items-center justify-center shadow-sm">
                        <FontAwesome6 name="chart-pie" size={20} color="#FFFFFF" />
                     </View>

                     <View className="flex-1">
                        <Text className="text-2xl font-bold text-gray-900 mb-1">
                           Spending Analytics
                        </Text>
                        <Text className="text-sm text-gray-600">
                           Deep insights into your shopping patterns and habits
                        </Text>
                     </View>
                  </View>

                  {/* Insight card */}
                  <View className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
                     <InsightRow label="Top category" value={analytics.topCategory} />
                     <InsightRow label="Most saved at" value={analytics.mostSavedAt} valueClass="text-primary_green" />
                     <InsightRow label="Best shopping day" value={analytics.bestDay} />
                  </View>

                  {/* Bottom tiles */}
                  <View className="flex-row gap-4 mb-6">
                     <View className="flex-1 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                        <Text className="text-sm font-semibold text-gray-600 mb-2">Avg. basket</Text>
                        <Text className="text-2xl font-bold text-gray-900">
                           ${analytics.avgBasket.toFixed(2)}
                        </Text>
                     </View>

                     <View className="flex-1 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                        <Text className="text-sm font-semibold text-gray-600 mb-2">Savings rate</Text>
                        <Text className="text-2xl font-bold text-primary_green">
                           {analytics.savingsRate}%
                        </Text>
                     </View>
                  </View>

                  {/* Gradient CTA */}
                  <Pressable className="w-full rounded-2xl overflow-hidden shadow-sm">
                     <View className="py-4 items-center justify-center bg-transparent">
                        <GradientBg />
                        <Text className="text-white font-semibold">View Full Analytics</Text>
                     </View>
                  </Pressable>
               </View>
            </View>
         </View>
      </View>
   );
}

function InsightRow({
   label,
   value,
   valueClass,
}: {
   label: string;
   value: string;
   valueClass?: string;
}) {
   return (
      <View className="flex-row items-center justify-between py-2">
         <Text className="text-sm font-semibold text-gray-600">{label}</Text>
         <Text className={["text-sm font-bold text-gray-900", valueClass ?? ""].join(" ")}>
            {value}
         </Text>
      </View>
   );
}

/**
 * Pure RN gradient without extra deps.
 * This SVG sits behind the CTA label.
 */
function GradientBg() {
   return (
      <View className="absolute inset-0">
         <Svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
            <Path
               d="M0,0 L100,0 L100,40 L0,40 Z"
               fill="url(#g)"
            />
            {/* eslint-disable-next-line react/no-unknown-property */}
            <defs>
               {/* eslint-disable-next-line react/no-unknown-property */}
               <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
                  {/* eslint-disable-next-line react/no-unknown-property */}
                  <stop offset="0" stopColor="#7C3AED" />
                  {/* eslint-disable-next-line react/no-unknown-property */}
                  <stop offset="1" stopColor="#DB2777" />
               </linearGradient>
            </defs>
         </Svg>
      </View>
   );
}
