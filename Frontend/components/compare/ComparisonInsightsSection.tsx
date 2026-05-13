import React from "react";
import { View, Text } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

type InsightCardVariant = "green" | "blue";

type InsightCardProps = {
   icon: string;
   iconVariant: InsightCardVariant;
   title: string;          // big number or big label (Aldi / $8.85 / 22% / 3)
   subtitle: string;       // short line under title (Best overall value / Total potential savings / etc.)
   caption: string;        // small helper text (Wins on 2 out of 4 products / By choosing cheapest option / etc.)
};

export default function ComparisonInsightsSection() {
   const cards: InsightCardProps[] = [
      {
         icon: "trophy",
         iconVariant: "green",
         title: "Aldi",
         subtitle: "Best overall value",
         caption: "Wins on 2 out of 4 products",
      },
      {
         icon: "piggy-bank",
         iconVariant: "green",
         title: "$8.85",
         subtitle: "Total potential savings",
         caption: "By choosing cheapest option",
      },
      {
         icon: "percent",
         iconVariant: "blue",
         title: "22%",
         subtitle: "Average discount",
         caption: "Across all compared items",
      },
      {
         icon: "chart-line",
         iconVariant: "green",
         title: "3",
         subtitle: "Price drops detected",
         caption: "In the last 7 days",
      },
   ];

   return (
      <View className="px-4 md:px-8 py-10 bg-[#F9FAFB]">
         <View className="max-w-7xl mx-auto">
            {/* Header */}
            <View className="mb-6 items-center">
               <Text className="text-2xl font-bold text-gray-900 text-center">
                  Comparison Insights
               </Text>
               <Text className="text-sm text-gray-600 mt-1 text-center">
                  Data-driven insights from your product comparison
               </Text>
            </View>

            {/* Cards row */}
            <View className="flex-row flex-wrap gap-5">
               {cards.map((c) => (
                  <InsightCard key={c.title} {...c} />
               ))}
            </View>
         </View>
      </View>
   );
}

function InsightCard({
   icon,
   iconVariant,
   title,
   subtitle,
   caption,
}: InsightCardProps) {
   const iconBg =
      iconVariant === "blue" ? "bg-indigo-500" : "bg-primary_green";
   const iconTint =
      iconVariant === "blue" ? "#FFFFFF" : "#FFFFFF";

   // Make $ amounts green like the mock
   const titleColor =
      title.startsWith("$") ? "text-primary_green" : "text-gray-900";

   return (
      <View className="flex-1 min-w-[220px] bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5">
         {/* Floating icon tile */}
         <View className="mb-4">
            <View
               className={[
                  "w-12 h-12 rounded-2xl items-center justify-center shadow-sm",
                  iconBg,
               ].join(" ")}
            >
               <FontAwesome6 name={icon as any} size={18} color={iconTint} />
            </View>
         </View>

         {/* Main content */}
         <Text className={["text-3xl font-bold", titleColor].join(" ")}>
            {title}
         </Text>
         <Text className="text-sm font-semibold text-gray-700 mt-2">
            {subtitle}
         </Text>
         <Text className="text-xs text-gray-500 mt-3">
            {caption}
         </Text>
      </View>
   );
}
