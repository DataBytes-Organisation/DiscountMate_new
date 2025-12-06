import React, { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

type Category = {
   label: string;
   icon: string;
};

const CATEGORIES: Category[] = [
   { label: "Pantry", icon: "box" },
   { label: "Dairy", icon: "cheese" },
   { label: "Drinks", icon: "bottle-water" },
   { label: "Frozen", icon: "snowflake" },
   { label: "Household", icon: "house" },
   { label: "Snacks", icon: "cookie" },
   { label: "Health", icon: "heart-pulse" },
   { label: "Baby", icon: "baby" },
   { label: "Pet Care", icon: "paw" },
   { label: "Personal Care", icon: "spray-can" },
   { label: "Bakery", icon: "bread-slice" },
   { label: "Meat & Seafood", icon: "drumstick-bite" },
   { label: "Fruit & Veg", icon: "apple-whole" },
   { label: "Tea & Coffee", icon: "mug-hot" },
   { label: "Liquor", icon: "wine-bottle" },
];

export default function SidebarCategories() {
   const [activeCategory, setActiveCategory] = useState<string>("Pantry");

   return (
      <View
         // wrapper so we can use sticky only on web
         style={{ position: "sticky" as any, top: 200, height: "calc(100vh - 200px)" as any }}
         className="hidden md:flex w-64"
      >
         <View className="flex-1 bg-white border-r border-gray-100 shadow-sm">
            <ScrollView
               contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 16 }}
            >
               <Text className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-4">
                  Categories
               </Text>

               {CATEGORIES.map(({ label, icon }) => {
                  const isActive = label === activeCategory;

                  return (
                     <Pressable
                        key={label}
                        onPress={() => setActiveCategory(label)}
                        className={[
                           "flex-row items-center px-4 py-3 rounded-xl mb-1 group transition-all",
                           isActive ? "bg-primary/5" : "bg-white hover:bg-primary/5",
                        ].join(" ")}
                     >
                        <FontAwesome6
                           name={icon}
                           size={18}
                           className={[
                              "mr-3 text-gray-400 transition-colors",
                              isActive ? "text-primary" : "group-hover:text-primary",
                           ].join(" ")}
                        />
                        <Text
                           className={[
                              "text-sm font-medium",
                              isActive
                                 ? "text-primary"
                                 : "text-gray-700 group-hover:text-primary",
                           ].join(" ")}
                        >
                           {label}
                        </Text>
                     </Pressable>
                  );
               })}
            </ScrollView>
         </View>
      </View>
   );
}
