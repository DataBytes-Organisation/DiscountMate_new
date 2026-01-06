// app/(tabs)/compare.tsx
import React, { useState } from "react";
import { View, ScrollView, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import ProductComparisonSection from "../../components/compare/ProductComparisonSection";
import ComparisonInsightsSection from "../../components/compare/ComparisonInsightsSection";
import BasketComparisonSection from "../../components/compare/BasketComparisonSection";
import MultiStoreShoppingStrategySection from "../../components/compare/MultiStoreShoppingStrategySection";
import PriceHistoryTrendsSection from "../../components/compare/PriceHistoryTrendsSection";
import SmartSubstitutionsSection from "../../components/compare/SmartSubstitutionsSection";
import AdvancedComparisonToolsSection from "../../components/compare/AdvancedComparisonToolsSection";
import ExportShareSection from "../../components/compare/ExportShareSection";
import FooterSection from "../../components/home/FooterSection";

type ViewMode = "basket" | "product";

export default function CompareScreen() {
   const [activeView, setActiveView] = useState<ViewMode>("basket");

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
                        Product & Grocery List Comparison
                     </Text>
                     <Text className="text-lg text-gray-600 text-center">
                        Compare products across retailers or review your grocery list to maximize savings
                     </Text>
                  </View>

                  {/* Tabs */}
                  <View className="flex-row items-center gap-4 justify-center">
                     {/* Grocery List Comparison Tab */}
                     <Pressable
                        onPress={() => setActiveView("basket")}
                        className={`flex-row items-center gap-3 px-6 py-4 rounded-2xl ${activeView === "basket"
                              ? "bg-primary_green"
                              : "border border-gray-200 bg-white"
                           }`}
                     >
                        <FontAwesome6
                           name="list"
                           size={16}
                           color={activeView === "basket" ? "#FFFFFF" : "#374151"}
                        />
                        <Text
                           className={`text-base font-semibold ${activeView === "basket" ? "text-white" : "text-gray-800"
                              }`}
                        >
                           Grocery List Comparison
                        </Text>
                     </Pressable>

                     {/* Product Comparison Tab */}
                     <Pressable
                        onPress={() => setActiveView("product")}
                        className={`flex-row items-center gap-3 px-6 py-4 rounded-2xl ${activeView === "product"
                              ? "bg-primary_green"
                              : "border border-gray-200 bg-white"
                           }`}
                     >
                        <FontAwesome6
                           name="box"
                           size={16}
                           color={activeView === "product" ? "#FFFFFF" : "#374151"}
                        />
                        <Text
                           className={`text-base font-semibold ${activeView === "product" ? "text-white" : "text-gray-800"
                              }`}
                        >
                           Product Comparison
                        </Text>
                     </Pressable>
                  </View>
               </View>
            </View>

            {/* Conditionally render sections based on active view */}
            {activeView === "product" ? (
               <>
                  <ProductComparisonSection />
                  <ComparisonInsightsSection />
               </>
            ) : (
               <BasketComparisonSection />
            )}

            {/* Common sections shown for both views */}
            <MultiStoreShoppingStrategySection />
            <PriceHistoryTrendsSection />
            <SmartSubstitutionsSection />
            <AdvancedComparisonToolsSection />
            <ExportShareSection />
            <FooterSection />
         </ScrollView>
      </View>
   );
}
