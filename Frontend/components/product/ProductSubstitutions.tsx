import React from "react";
import { View, Text, Pressable, Image } from "react-native";

interface Substitution {
   name: string;
   subtitle: string;
   price: number;
   retailer: string;
   badgeLabel: string;
   badgeVariant: "quality" | "value" | "diet";
   diffText: string;
   image: string;
}

interface ProductSubstitutionsProps {
   productId?: string | string[];
}

export default function ProductSubstitutions({
   productId,
}: ProductSubstitutionsProps) {
   // Mock data matching the design
   const substitutions: Substitution[] = [
      {
         name: "Organic Full Cream Milk 2L",
         subtitle: "Premium organic certified",
         price: 6.0,
         retailer: "Woolworths",
         badgeLabel: "Better Quality",
         badgeVariant: "quality",
         diffText: "+$2.50 more",
         image:
            "https://images.pexels.com/photos/1558533/pexels-photo-1558533.jpeg",
      },
      {
         name: "Full Cream Milk 3L Family Pack",
         subtitle: "Larger size for families",
         price: 4.95,
         retailer: "Coles",
         badgeLabel: "Better Value",
         badgeVariant: "value",
         diffText: "Save $0.45/L",
         image:
            "https://images.pexels.com/photos/3738095/pexels-photo-3738095.jpeg",
      },
      {
         name: "A2 Full Cream Milk 2L",
         subtitle: "Easier to digest A2 protein",
         price: 6.5,
         retailer: "Woolworths",
         badgeLabel: "Special Diet",
         badgeVariant: "diet",
         diffText: "+$3.00 more",
         image:
            "https://images.pexels.com/photos/884600/pexels-photo-884600.jpeg",
      },
   ];

   const getBadgeClasses = (variant: Substitution["badgeVariant"]) => {
      switch (variant) {
         case "quality":
            return {
               container: "bg-amber-100",
               text: "text-amber-800",
            };
         case "value":
            return {
               container: "bg-emerald-100",
               text: "text-emerald-800",
            };
         case "diet":
            return {
               container: "bg-purple-100",
               text: "text-purple-800",
            };
         default:
            return {
               container: "bg-gray-100",
               text: "text-gray-800",
            };
      }
   };

   return (
      <View className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
         {/* Header */}
         <View className="flex-row items-center justify-between mb-5">
            <Text className="text-xl font-bold text-gray-900">
               Smart Substitutions
            </Text>
            <Text className="text-sm text-gray-500">
               Similar products you might like
            </Text>
         </View>

         {/* List */}
         <View>
            {substitutions.map((sub, index) => {
               const badge = getBadgeClasses(sub.badgeVariant);

               return (
                  <View
                     key={sub.name}
                     className={[
                        "flex-row items-center rounded-2xl border border-gray-200 px-4 py-4",
                        index < substitutions.length - 1 ? "mb-4" : "",
                     ].join(" ")}
                  >
                     {/* Image */}
                     <View className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 mr-4">
                        <Image
                           source={{ uri: sub.image }}
                           className="w-full h-full"
                           resizeMode="cover"
                        />
                     </View>

                     {/* Middle: text + badge */}
                     <View className="flex-1 mr-4">
                        <Text className="text-base font-semibold text-gray-900">
                           {sub.name}
                        </Text>
                        <Text className="text-sm text-gray-600 mt-1">
                           {sub.subtitle}
                        </Text>

                        <View className="flex-row items-center gap-3 mt-2">
                           <View
                              className={[
                                 "px-3 py-1 rounded-full",
                                 badge.container,
                              ].join(" ")}
                           >
                              <Text
                                 className={[
                                    "text-xs font-semibold",
                                    badge.text,
                                 ].join(" ")}
                              >
                                 {sub.badgeLabel}
                              </Text>
                           </View>

                           <Text
                              className={
                                 sub.badgeVariant === "value"
                                    ? "text-xs font-semibold text-emerald-700"
                                    : "text-xs text-gray-500"
                              }
                           >
                              {sub.diffText}
                           </Text>
                        </View>
                     </View>

                     {/* Right: price + retailer + button */}
                     <View className="items-end">
                        <Text className="text-xl font-bold text-gray-900">
                           ${sub.price.toFixed(2)}
                        </Text>
                        <Text className="text-xs text-gray-500 mt-1">
                           at {sub.retailer}
                        </Text>

                        <Pressable className="mt-3 px-5 py-2 rounded-xl bg-primary_green items-center">
                           <Text className="text-sm font-semibold text-white">
                              View
                           </Text>
                        </Pressable>
                     </View>
                  </View>
               );
            })}
         </View>
      </View>
   );
}
