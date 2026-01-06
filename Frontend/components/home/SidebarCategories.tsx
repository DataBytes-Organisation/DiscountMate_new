import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
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

// Convert category label to URL-friendly slug
function categoryLabelToSlug(label: string): string {
   return label
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/&/g, "and")
      .replace(/,/g, "")
      .replace(/--+/g, "-")
      .replace(/^-|-$/g, "");
}

// Convert URL slug back to category label
function slugToCategoryLabel(slug: string): string | null {
   const normalizedSlug = slug.toLowerCase().trim();
   const category = CATEGORIES.find(cat =>
      categoryLabelToSlug(cat.label) === normalizedSlug
   );
   return category ? category.label : null;
}

type SidebarCategoriesProps = {
   activeCategory: string;
   onSelect?: (category: string) => void; // Optional for backward compatibility
   useNavigation?: boolean; // If true, use router navigation instead of onSelect
};

export default function SidebarCategories({
   activeCategory,
   onSelect,
   useNavigation = false,
}: SidebarCategoriesProps) {
   const router = useRouter();

   const handleCategorySelect = (label: string) => {
      if (useNavigation) {
         // Use navigation approach (always takes precedence)
         if (label === "All") {
            router.push("/");
         } else {
            const slug = categoryLabelToSlug(label);
            router.push(`/category/${slug}`);
         }
      } else if (onSelect) {
         // Use callback approach (for backward compatibility)
         onSelect(label);
      } else {
         // Fallback to navigation if no callback provided
         if (label === "All") {
            router.push("/");
         } else {
            const slug = categoryLabelToSlug(label);
            router.push(`/category/${slug}`);
         }
      }
   };

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
                        onPress={() => handleCategorySelect(label)}
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

// Export helper functions for use in other components
export { categoryLabelToSlug, slugToCategoryLabel };
