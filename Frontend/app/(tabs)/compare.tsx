// app/(tabs)/compare.tsx
import React from "react";
import { View, ScrollView, Text } from "react-native";
import ProductComparisonSection from "../../components/compare/ProductComparisonSection";
import ComparisonInsightsSection from "../../components/compare/ComparisonInsightsSection";
import PriceHistoryTrendsSection from "../../components/compare/PriceHistoryTrendsSection";
import SmartSubstitutionsSection from "../../components/compare/SmartSubstitutionsSection";
import AdvancedComparisonToolsSection from "../../components/compare/AdvancedComparisonToolsSection";
import ExportShareSection from "../../components/compare/ExportShareSection";
import FooterSection from "../../components/home/FooterSection";

export default function CompareScreen() {
   return (
      <View className="flex-1 bg-[#F9FAFB]">
         <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 24 }}
         >
            {/* Hero Section */}
            <View className="px-4 md:px-8 py-10 bg-white border-b border-gray-100">
               <View className="w-full">
                  {/* Title + subtitle */}
                  <View className="mb-7 items-center">
                     <Text className="text-4xl font-bold text-gray-900 mb-2 text-center">
                        Product Comparison
                     </Text>
                     <Text className="text-lg text-gray-600 text-center">
                        Compare products across retailers to find the best value
                     </Text>
                  </View>
               </View>
            </View>

            <ProductComparisonSection />
            <ComparisonInsightsSection />

            <PriceHistoryTrendsSection />
            <SmartSubstitutionsSection />
            <AdvancedComparisonToolsSection />
            <ExportShareSection />
            <FooterSection />
         </ScrollView>
      </View>
   );
}
