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
               paddingHorizontal: 16,
               paddingVertical: 8,
            }}
         >
            {TABS.map((label, index) => {
               const isActive = index === activeIndex;
               return (
                  <Pressable
                     key={label}
                     className={[
                        "px-5 py-2 rounded-full mr-3 border",
                        isActive
                           ? "bg-gradient-to-r from-[#10B981] to-[#059669]"
                           : "bg-white border-gray-200",
                     ].join(" ")}
                  >
                     <Text
                        className={
                           isActive
                              ? "text-sm font-medium text-white"
                              : "text-sm font-medium text-gray-700"
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
