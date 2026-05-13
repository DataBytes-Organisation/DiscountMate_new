// app/(tabs)/category/[id].tsx
import React from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import CategoryMainSection from "../../../components/category/CategoryMainSection";
import CategoryInsightsSection from "../../../components/category/CategoryInsightsSection";
import FooterSection from "../../../components/home/FooterSection";

export default function CategoryScreen() {
   const { id } = useLocalSearchParams<{ id: string }>();

   return (
      <View className="flex-1 bg-[#F9FAFB]">
         <CategoryMainSection categoryId={id} />
         <CategoryInsightsSection categoryId={id} />
         <FooterSection />
      </View>
   );
}
