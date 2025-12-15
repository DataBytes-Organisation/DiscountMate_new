import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

type Category = {
   label: string;
   icon: string;
};

const CATEGORIES: Category[] = [
   { label: "All", icon: "border-all" },
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

type SidebarCategoriesProps = {
   activeCategory: string;
   onSelect: (category: string) => void;
};

export default function SidebarCategories({
   activeCategory,
   onSelect,
}: SidebarCategoriesProps) {

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
                        onPress={() => onSelect(label)}
                        className={[
                           "flex-row items-center px-4 py-3 rounded-xl mb-1 group transition-all",
                           isActive
                              ? "bg-primary_green/10 border border-primary_green/40"
                              : "bg-white border border-transparent hover:bg-primary_green/5",
                        ].join(" ")}
                     >
                        <FontAwesome6
                           name={icon}
                           size={18}
                           className={[
                              "mr-3 text-gray-400 transition-colors",
                              isActive
                                 ? "text-primary_green"
                                 : "group-hover:text-primary_green",
                           ].join(" ")}
                        />
                        <Text
                           className={[
                              "text-sm font-medium",
                              isActive
                                 ? "text-primary_green"
                                 : "text-gray-700 group-hover:text-primary_green",
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
