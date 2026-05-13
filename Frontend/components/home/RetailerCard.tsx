// Frontend/components/product/RetailerCard.tsx
import React from "react";
import { View, Text } from "react-native";
import { STORE_THEMES } from "../../storeThemes.config";

export type StoreKey = keyof typeof STORE_THEMES;

export type Retailer = {
   storeKey: StoreKey;
   name: string;
   price: string;
   isCheapest?: boolean;
   unitPriceLabel?: string; // e.g. "$1.23 / unit"
};

type Props = { retailer: Retailer };

/** Solid fills — RN does not paint CSS linear-gradient (`bg-gradient-to-br` + from/to) on Views. */
const cheapestBg: Record<StoreKey, string> = {
   coles: "bg-red-50",
   woolworths: "bg-emerald-50",
   aldi: "bg-blue-50",
   iga: "bg-gradient-to-br from-[#FFF0F1] to-[#FDE2E4]",
};

const cheapestAccent: Record<StoreKey, string> = {
   coles: "border border-red-400/50 shadow-sm ring-1 ring-red-300/30",
   woolworths: "border border-emerald-400/55 shadow-sm ring-1 ring-emerald-300/30",
   aldi: "border border-blue-400/50 shadow-sm ring-1 ring-blue-300/30",
   iga: "bg-[#E31B23]/10 border border-neutral-800/70 shadow-md ring-1 ring-neutral-900/10",
};

export default function RetailerCard({ retailer }: Props) {
   const { storeKey, name, price, isCheapest, unitPriceLabel } = retailer;

   const theme = STORE_THEMES[storeKey];

   if (isCheapest) {
      return (
         <View
            className={[
               "flex-1 p-2 rounded-lg items-center",
               cheapestBg[storeKey],
               cheapestAccent[storeKey],
            ].join(" ")}
         >
            <Text className="text-[11px] text-gray-500 mb-1 font-medium">
               {name}
            </Text>

            <Text className={["text-base font-bold", theme.text].join(" ")}>
               {price}
            </Text>

            {unitPriceLabel && (
               <Text className="text-[11px] text-gray-600 mt-0.5">
                  {unitPriceLabel}
               </Text>
            )}
         </View>
      );
   }

   return (
      <View className="flex-1 p-2 rounded-lg bg-gray-50 items-center">
         <Text className="text-[11px] text-gray-500 mb-1 font-medium">
            {name}
         </Text>

         <Text className="text-base font-bold text-[#111827]">{price}</Text>

         {unitPriceLabel && (
            <Text className="text-[11px] text-gray-600 mt-0.5">
               {unitPriceLabel}
            </Text>
         )}
      </View>
   );
}
