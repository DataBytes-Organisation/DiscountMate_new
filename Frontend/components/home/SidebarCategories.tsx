import React, { useEffect, useMemo, useState } from "react";
import {View, Text, ScrollView, Pressable} from "react-native";
import { useRouter } from "expo-router";
import {fetchCatalogueCategories} from "@/services/catalogue/catalogueApi";
import type {CatalogueCategory,CatalogueSource} from "@/services/catalogue/types";

type Category = {
   id?: string | null;
   label: string;
};

type SidebarCategoriesProps = {
   activeCategory: string;
   onSelect?: (category: string) => void;
   useNavigation?: boolean;
   source?: CatalogueSource;
};

function toTitleCase(input: string): string {
   const value = input.trim();
   if (!value) return value;
   return value
      .toLowerCase()
      .replace(/\b[a-z]/g, (letter) =>
         letter.toUpperCase()
      );
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

function SidebarCategorySkeletonRow({
   widthClass,
}: {
   widthClass: string;
}) {
   return (
      <View className="px-3 py-2 rounded-xl mb-1 bg-transparent">
         <View
            className={[
               "h-4 rounded bg-gray-200",
               widthClass,
            ].join(" ")}
         />
      </View>
   );
}

export default function SidebarCategories({
   activeCategory,
   onSelect,
   useNavigation = false,
   source = "mongo",
}: SidebarCategoriesProps) {
   const router = useRouter();

   const [categories, setCategories] = useState<
      CatalogueCategory[]
   >([]);
   const [loading, setLoading] = useState(true);

   const navigateToCategory = (category: Category) => {
      if (source === "postgres") {
         if (!category.id || category.label === "All") {
            router.push("/postgresproductpage");
            return;
         }
         router.push({
            pathname: "/postgresproductpage",
            params: {
               categoryId: category.id,
            },
         });
         return;
      }

      if (!category.id || category.label === "All") {
         router.push("/");
         return;
      }
      router.push(`/category/${category.id}`);
   };

   const handleCategorySelect = (category: Category) => {
      if (!useNavigation && onSelect) {
         onSelect(category.label);
         return;
      }
      navigateToCategory(category);
   };

   useEffect(() => {
      const controller = new AbortController();
      async function loadCategories() {
         try {
            setLoading(true);
            const result =
               await fetchCatalogueCategories(
                  source,
                  controller.signal
               );

            if (!controller.signal.aborted) {
               setCategories(result);
            }
         } catch (error) {
            if (
               error instanceof Error &&
               error.name === "AbortError"
            ) {
               return;
            }
            console.error(
               "Failed to load categories:",
               error
            );
            if (!controller.signal.aborted) {
               setCategories([]);
            }
         } finally {
            if (!controller.signal.aborted) {
               setLoading(false);
            }
         }
      }
      loadCategories();
      return () => controller.abort();
   }, [source]);

   const categoriesForUi: Category[] = useMemo(
      () => [
         {
            id: null,
            label: "All",
         },
         ...categories
            .filter((category) => category.name?.trim())
            .map((category) => ({
               id: category.id,
               label: toTitleCase(category.name),
            })),
      ],
      [categories]
   );

   return (
      <View
         style={{
            position: "sticky" as any,
            top: 0,
            alignSelf: "flex-start",
            maxHeight: "100vh",
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
               showsVerticalScrollIndicator
            >
               <Text className="text-xs text-gray-500 uppercase tracking-[0.15em] mb-4">
                  Categories
               </Text>
               {loading ? (
                  <>
                     {Array.from({ length: 10 }).map(
                        (_, index) => {
                           const widthClass =
                              index % 4 === 0
                                 ? "w-40"
                                 : index % 4 === 1
                                    ? "w-32"
                                    : index % 4 === 2
                                       ? "w-44"
                                       : "w-28";
                           return (
                              <SidebarCategorySkeletonRow
                                 key={`cat-skel-${index}`}
                                 widthClass={widthClass}
                              />
                           );
                        }
                     )}
                  </>
               ) : (
                  categoriesForUi.map((category) => {
                     const byId =
                        Boolean(category.id) &&
                        String(category.id).toLowerCase() ===
                        activeCategory.toLowerCase();

                     const byName =
                        normaliseCategoryKey(
                           activeCategory
                        ) ===
                        normaliseCategoryKey(
                           category.label
                        );
                     const isActive = byId || byName;
                     return (
                        <Pressable
                           key={
                              category.id ||
                              category.label
                           }
                           onPress={() =>
                              handleCategorySelect(
                                 category
                              )
                           }
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
                              {category.label}
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
