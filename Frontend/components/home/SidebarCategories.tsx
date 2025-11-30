import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";

const CATEGORIES = [
   ["Pantry", "📦"],
   ["Dairy", "🧀"],
   ["Drinks", "🥤"],
   ["Frozen", "❄️"],
   ["Household", "🏠"],
   ["Snacks", "🍪"],
   ["Health", "❤️"],
   ["Baby", "👶"],
   ["Pet Care", "🐾"],
   ["Personal Care", "🧴"],
   ["Bakery", "🍞"],
   ["Meat & Seafood", " drumstick"], // replace with icon lib later
   ["Fruit & Veg", "🍎"],
   ["Tea & Coffee", "☕"],
   ["Liquor", "🍷"],
];

export default function SidebarCategories() {
   return (
      <View className="hidden md:flex w-64 bg-white border-r border-gray-100 shadow-sm">
         <ScrollView
            contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 16 }}
         >
            <Text className="text-[11px] font-bold text-gray-500 tracking-widest mb-4">
               CATEGORIES
            </Text>
            {CATEGORIES.map(([label, emoji]) => (
               <Pressable
                  key={label}
                  className="flex-row items-center px-4 py-3 rounded-xl mb-1 bg-white"
               >
                  <Text className="mr-3 text-gray-500 text-base">{emoji}</Text>
                  <Text className="text-sm font-medium text-gray-700">{label}</Text>
               </Pressable>
            ))}
         </ScrollView>
      </View>
   );
}
