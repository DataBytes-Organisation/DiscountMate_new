// app/(tabs)/index.tsx
import React from "react";
import { View } from "react-native";
import HomeMainSection from "../../components/home/HomeMainSection";
import TrendingInsightsSection from "../../components/home/TrendingInsightsSection";
import SavingsSummarySection from "../../components/home/SavingsSummarySection";
import SmartListsSection from "../../components/home/SmartListsSection";
import PriceAlertsSection from "../../components/home/PriceAlertsSection";
import ComparisonToolsSection from "../../components/home/ComparisonToolsSection";
import RetailerPerformanceSection from "../../components/home/RetailerPerformanceSection";
import WeeklySpecialsSection from "../../components/home/WeeklySpecialsSection";
import FooterSection from "../../components/home/FooterSection";

export default function HomeScreen() {
   return (
      <View className="flex-1 bg-[#F9FAFB]">
         <HomeMainSection />
         <TrendingInsightsSection />
         <SavingsSummarySection />
         <SmartListsSection />
         <PriceAlertsSection />
         <ComparisonToolsSection />
         <RetailerPerformanceSection />
         <WeeklySpecialsSection />
         <FooterSection />
      </View>
   );
}
