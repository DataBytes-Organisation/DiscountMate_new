import React from "react";
import { View } from "react-native";
import SearchResultsMainSection from "../../components/search/SearchResultsMainSection";
import FooterSection from "../../components/home/FooterSection";

export default function SearchResults() {
   return (
      <View className="flex-1 bg-[#F9FAFB]">
         <SearchResultsMainSection />
         <FooterSection />
      </View>
   );
}
