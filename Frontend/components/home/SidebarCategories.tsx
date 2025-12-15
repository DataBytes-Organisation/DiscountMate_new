import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

type Category = {
   label: string;
   icon: string;
};

// Keep UI labels aligned with database categories. Close-but-not-identical
// names have been normalised to match the dataset (e.g. "Fruit & Veg" ->
// "Fruit & Vegetables", "Health" -> "Health & Beauty").
const CATEGORIES: Category[] = [
   { label: "All", icon: "border-all" },
   { label: "Bakery", icon: "bread-slice" },
   { label: "Dairy, Eggs & Fridge", icon: "cheese" },
   { label: "Deli", icon: "bacon" },
   { label: "Drinks", icon: "bottle-water" },
   { label: "Frozen", icon: "snowflake" },
   { label: "Fruit & Vegetables", icon: "apple-whole" },
   { label: "Health & Beauty", icon: "heart-pulse" },
   { label: "Household", icon: "house" },
   { label: "Meat & Seafood", icon: "drumstick-bite" },
   { label: "Pantry", icon: "box" },
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
         // outer wrapper: sticky on web, aligned with product grid
         style={{
            position: "sticky" as any,
            top: 0,                            // no huge gap; sits with content
            alignSelf: "flex-start",
            maxHeight: "100vh",               // limit height so inner scroll can work
         }}
         className="hidden md:flex w-64"
      >
         <View className="flex-1 bg-white border-r border-gray-100 shadow-sm overflow-hidden">
            <ScrollView
               style={{ flex: 1 }}
               contentContainerStyle={{
                  paddingVertical: 24,
                  paddingHorizontal: 16,
               }}
               showsVerticalScrollIndicator={true}
            >
               <Text className="text-xs text-gray-500 uppercase tracking-[0.15em] mb-4">
                  Categories
               </Text>

               {CATEGORIES.map(({ label, icon }) => {
                  const isActive = activeCategory === label;

                  return (
                     <Pressable
                        key={label}
                        onPress={() => onSelect(label)}
                        className={[
                           "group flex-row items-center px-3 py-2 rounded-xl mb-1",
                           isActive
                              ? "bg-[#E5F7F0]"
                              : "bg-transparent hover:bg-gray-50",
                        ].join(" ")}
                     >
                        <FontAwesome6
                           name={icon as any}
                           size={16}
                           className={[
                              "mr-3",
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
