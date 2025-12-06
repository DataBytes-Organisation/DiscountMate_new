import React from "react";
import { ScrollView, Pressable, Text, View } from "react-native";

const TABS = [
   "Cheapest Today",
   "On Special",
   "Trending Down",
   "High Savings",
   "Bulk Deals",
   "More...",
];

export default function CategoryTabs() {
   const activeIndex = 0;

   return (
      <View className="bg-white border-b border-gray-100">
         <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
               paddingHorizontal: 32, // px-8
               paddingVertical: 12,   // py-3
               alignItems: "center",
            }}
         >
            {TABS.map((label, index) => {
               const isActive = index === activeIndex;

               return (
                  <Pressable
                     key={label}
                     className={[
                        "group px-5 py-2 rounded-full mr-3 transition-shadow",
                        isActive
                           ? "bg-gradient-to-r from-primary_green to-secondary_green shadow-sm hover:shadow-lg"
                           : "bg-white border border-gray-200 hover:bg-primary_green/5 transition-colors",
                        "whitespace-nowrap",
                     ].join(" ")}
                  >
                     <Text
                        className={
                           isActive
                              ? "text-sm font-medium text-white"
                              : "text-sm font-medium text-gray-700 group-hover:text-primary_green transition-colors"
                        }
                     >
                        {label}
                     </Text>
                  </Pressable>
               );
            })}
         </ScrollView>
      </View>
   );
}
