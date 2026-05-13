import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, usePathname } from "expo-router";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

interface BreadcrumbItem {
   label: string;
   path?: string;
}

interface BreadcrumbsProps {
   items?: BreadcrumbItem[];
   productName?: string;
   categoryName?: string;
}

export default function Breadcrumbs({ items, productName, categoryName }: BreadcrumbsProps) {
   const router = useRouter();
   const pathname = usePathname();

   // If items are provided, use them; otherwise generate from pathname
   let breadcrumbItems: BreadcrumbItem[] = [];

   if (items) {
      breadcrumbItems = items;
   } else {
      // Default breadcrumbs
      breadcrumbItems = [
         { label: "Home", path: "/" },
      ];

      if (categoryName) {
         breadcrumbItems.push({
            label: categoryName,
            path: `/category/${categoryName.toLowerCase().replace(/\s+/g, "-")}`,
         });
      }

      if (productName) {
         breadcrumbItems.push({
            label: productName,
         });
      }
   }

   return (
      <View className="bg-white border-b border-gray-100 px-4 md:px-8 py-3">
         <View className="flex-row items-center gap-2">
            {breadcrumbItems.map((item, index) => {
               const isLast = index === breadcrumbItems.length - 1;

               return (
                  <React.Fragment key={index}>
                     {item.path && !isLast ? (
                        <Pressable onPress={() => router.push(item.path!)}>
                           <Text className="text-xs text-gray-500">
                              {item.label}
                           </Text>
                        </Pressable>
                     ) : (
                        <Text
                           className={`text-xs ${
                              isLast ? "text-gray-900 font-medium" : "text-gray-500"
                           }`}
                        >
                           {item.label}
                        </Text>
                     )}
                     {!isLast && (
                        <FontAwesome6 name="chevron-right" size={10} color="#9CA3AF" />
                     )}
                  </React.Fragment>
               );
            })}
         </View>
      </View>
   );
}

