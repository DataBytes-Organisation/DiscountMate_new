// Frontend/components/product/RetailerCard.tsx
import React from "react";
import { View, Text } from "react-native";
import { STORE_THEMES } from "../../storeThemes.config";

export type StoreKey = keyof typeof STORE_THEMES;

export type Retailer = {
   storeKey: StoreKey;
   name: string;
   price: string;
   originalPrice?: string;
   isCheapest?: boolean;
};

type Props = { retailer: Retailer };

export default function RetailerCard({ retailer }: Props) {
   const { storeKey, name, price, originalPrice, isCheapest } = retailer;

   const theme = STORE_THEMES[storeKey];

   if (isCheapest) {
      return (
         <View
            className={[
               "flex-1 p-2 rounded-lg items-center",

               // gradients MUST be literal to be recognized
               "bg-gradient-to-br",
               theme.from,           // e.g. "from-blue-50"
               theme.to,             // e.g. "to-blue-100"

               "border",
               theme.border,         // e.g. "border-blue-300"
            ].join(" ")}
         >
            <Text className="text-[11px] text-gray-500 mb-1 font-medium">
               {name}
            </Text>

            <Text className={["text-base font-bold", theme.text].join(" ")}>
               {price}
            </Text>

            {originalPrice && (
               <Text className="text-[11px] text-gray-400 line-through">
                  {originalPrice}
               </Text>
            )}

            <View
               className={[
                  "mt-1 px-2 py-0.5 rounded-full",
                  "bg-gradient-to-r",
                  theme.badgeFrom,    // must be literal
                  theme.badgeTo,
               ].join(" ")}
            >
               <Text className="text-[10px] font-bold text-white">
                  Cheapest
               </Text>
            </View>
         </View>
      );
   }

   return (
      <View className="flex-1 p-2 rounded-lg bg-gray-50 items-center">
         <Text className="text-[11px] text-gray-500 mb-1 font-medium">
            {name}
         </Text>

         <Text className="text-base font-bold text-[#111827]">
            {price}
         </Text>

         {originalPrice && (
            <Text className="text-[11px] text-gray-400 line-through">
               {originalPrice}
            </Text>
         )}
      </View>
   );
}
