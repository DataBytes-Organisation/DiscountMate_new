// Frontend/components/product/RetailerCard.tsx
import React from "react";
import { View, Text } from "react-native";
import { STORE_THEMES } from "../../storeThemes.config";

export type StoreKey = keyof typeof STORE_THEMES;

export type Retailer = {
   storeKey: StoreKey;         // "coles" | "woolworths" | "aldi"
   name: string;               // label shown on card: "Coles"
   price: string;              // "$3.50"
   originalPrice?: string;     // "$4.70"
   isCheapest?: boolean;
};

type RetailerCardProps = {
   retailer: Retailer;
};

export default function RetailerCard({ retailer }: RetailerCardProps) {
   const { storeKey, name, price, originalPrice, isCheapest } = retailer;

   const theme = STORE_THEMES[storeKey];

   if (isCheapest) {
      // The highlighted cheapest block (gradient + “Cheapest” badge)
      return (
         <View
            className={[
               "flex-1 p-2 rounded-lg items-center",
               "bg-gradient-to-br",
               theme.bg,          // gradient background
               theme.border,      // themed border
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
                  theme.cheapestGradient,
               ].join(" ")}
            >
               <Text className="text-[10px] font-bold text-white">
                  Cheapest
               </Text>
            </View>
         </View>
      );
   }

   // Normal gray card for non-cheapest retailers
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
