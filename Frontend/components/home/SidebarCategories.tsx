import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { API_URL } from "@/constants/Api";

type Category = {
   id?: string | null;
   label: string;
};

type DbCategory = {
   _id: string;
   category_name: string;
   description?: string | null;
   icon_url?: string | null;
   display_order?: number | null;
   is_active?: boolean;
};

function toTitleCase(input: string): string {
   const s = input.trim();
   if (!s) return s;
   return s
      .toLowerCase()
      .replace(/\b[a-z]/g, (m) => m.toUpperCase());
}

function normaliseCategoryKey(name: string): string {
   return name
      .trim()
      .toUpperCase()
      .replace(/&/g, "AND")
      .replace(/[^A-Z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
}

function isObjectId(value: string): boolean {
   return /^[0-9a-fA-F]{24}$/.test(value);
}

type SidebarCategoriesProps = {
   activeCategory: string;
   onSelect?: (category: string) => void; // Optional for backward compatibility
   useNavigation?: boolean; // If true, use router navigation instead of onSelect
};

function SidebarCategorySkeletonRow({ widthClass }: { widthClass: string }) {
   return (
      <View className="px-3 py-2 rounded-xl mb-1 bg-transparent">
         <View className={["h-4 rounded bg-gray-200", widthClass].join(" ")} />
      </View>
   );
}

export default function SidebarCategories({
   activeCategory,
   onSelect,
   useNavigation = false,
}: SidebarCategoriesProps) {
   const router = useRouter();
   const [dbCategories, setDbCategories] = useState<DbCategory[]>([]);
   const [loading, setLoading] = useState(true);

   const handleCategorySelect = (category: Category) => {
      if (useNavigation) {
         if (category.label === "All") {
            router.push("/");
            return;
         }

         if (category.id) {
            router.push(`/category/${category.id}`);
            return;
         }
         router.push("/");
      } else if (onSelect) {
         // Use callback approach (for backward compatibility)
         onSelect(category.label);
      } else {
         // Fallback to navigation if no callback provided
         if (category.label === "All") {
            router.push("/");
         } else {
            if (category.id) {
               router.push(`/category/${category.id}`);
            } else {
               router.push("/");
            }
         }
      }
   };

   useEffect(() => {
      let cancelled = false;

      async function loadCategories() {
         try {
            setLoading(true);
            const res = await fetch(`${API_URL}/categories`);
            if (!res.ok) {
               throw new Error(`Failed to fetch categories (${res.status})`);
            }
            const data = (await res.json()) as DbCategory[];
            if (!cancelled) {
               setDbCategories(Array.isArray(data) ? data : []);
            }
         } catch (e) {
            console.error("Failed to load categories:", e);
            if (!cancelled) {
               setDbCategories([]);
            }
         } finally {
            if (!cancelled) {
               setLoading(false);
            }
         }
      }

      loadCategories();
      return () => {
         cancelled = true;
      };
   }, []);

   const categoriesForUi: Category[] = useMemo(() => {
      const dynamic: Category[] = dbCategories
         .filter((c) => c?.category_name)
         .map((c) => ({
            id: c._id,
            label: toTitleCase(c.category_name),
         }));
      return [{ id: null, label: "All" }, ...dynamic];
   }, [dbCategories]);

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

               {loading ? (
                  <>
                     {Array.from({ length: 10 }).map((_, idx) => {
                        const widthClass =
                           idx % 4 === 0
                              ? "w-40"
                              : idx % 4 === 1
                                 ? "w-32"
                                 : idx % 4 === 2
                                    ? "w-44"
                                    : "w-28";
                        return (
                           <SidebarCategorySkeletonRow
                              key={`cat-skel-${idx}`}
                              widthClass={widthClass}
                           />
                        );
                     })}
                  </>
               ) : (
                  categoriesForUi.map((cat) => {
                     const byId =
                        isObjectId(activeCategory) &&
                        !!cat.id &&
                        String(cat.id).toLowerCase() === activeCategory.toLowerCase();
                     const byName =
                        normaliseCategoryKey(activeCategory) === normaliseCategoryKey(cat.label);
                     const isActive = byId || byName;

                     return (
                        <Pressable
                           key={cat.id || cat.label}
                           onPress={() => handleCategorySelect(cat)}
                           className={[
                              "group flex-row items-center px-3 py-2 rounded-xl mb-1",
                              isActive
                                 ? "bg-[#E5F7F0]"
                                 : "bg-transparent hover:bg-gray-50",
                           ].join(" ")}
                        >
                           <Text
                              className={[
                                 "text-sm font-medium",
                                 isActive
                                    ? "text-primary_green"
                                    : "text-gray-700 group-hover:text-primary_green",
                              ].join(" ")}
                           >
                              {cat.label}
                           </Text>
                        </Pressable>
                     );
                  })
               )}
            </ScrollView>
         </View>
      </View>
   );
}

export { };
