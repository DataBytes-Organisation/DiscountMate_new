// Frontend/components/product/ProductCard.tsx
import React from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import RetailerCard, { Retailer } from "./RetailerCard";
import AddButton from "../common/AddButton";
export type TrendTone = "green" | "red" | "orange" | "neutral";

export type Product = {
   name: string;
   subtitle: string;
   icon: React.ComponentProps<typeof FontAwesome6>["name"]; // e.g. "wine-glass"
   badge: string;       // e.g. "Save $1.20"
   trendLabel: string;  // e.g. "Trending down"
   trendTone: TrendTone;
   retailers: Retailer[];   // exactly 3 in your current design
};

type ProductCardProps = {
   product: Product;
};

function getTrendIcon(tone: TrendTone): React.ComponentProps<typeof FontAwesome6>["name"] {
   if (tone === "green") return "arrow-trend-down";
   if (tone === "red") return "arrow-trend-up";
   if (tone === "orange") return "fire";
   return "minus";
}

function getTrendColorClass(tone: TrendTone): string {
   if (tone === "green") return "text-[#10B981]";
   if (tone === "red") return "text-[#EF4444]";
   if (tone === "orange") return "text-[#F97316]";
   return "text-gray-500";
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
   const { name, subtitle, icon, badge, trendLabel, trendTone, retailers } = product;

   // Make sure exactly one retailer has isCheapest = true
   const normalizedRetailers: Retailer[] = (() => {
      const hasExplicitCheapest = retailers.some(r => r.isCheapest);

      if (hasExplicitCheapest || retailers.length === 0) {
         return retailers;
      }

      // No isCheapest flag set: pick the lowest price as backup
      const withNumericPrice = retailers.map(r => {
         const numeric = parseFloat((r.price || "").replace(/[^0-9.]/g, ""));
         return { r, numeric: isNaN(numeric) ? Number.POSITIVE_INFINITY : numeric };
      });

      const min = withNumericPrice.reduce((acc, curr) =>
         curr.numeric < acc.numeric ? curr : acc
      );

      return retailers.map(r =>
         r === min.r ? { ...r, isCheapest: true } : r
      );
   })();

   const trendIcon = getTrendIcon(trendTone);
   const trendColorClass = getTrendColorClass(trendTone);

   return (
      <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
         <View className="p-5">
            {/* Top: icon + title + badges */}
            <View className="flex-row items-start gap-4 mb-4">
               <View className="w-24 h-24 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 items-center justify-center flex-shrink-0">
                  <FontAwesome6 name={icon} size={24} color="#9CA3AF" />
               </View>

               <View className="flex-1 min-w-0">
                  <Text
                     className="text-dark font-bold mb-1"
                     numberOfLines={1}
                  >
                     {name}
                  </Text>
                  <Text className="text-xs text-gray-500 mb-3">
                     {subtitle}
                  </Text>

                  <View className="flex-row flex-wrap items-center gap-2">
                     {/* Savings badge */}
                     <View className="px-3 py-1 rounded-full bg-gradient-to-r from-accent/20 to-accent/10">
                        <Text className="text-[11px] font-bold text-accent">
                           {badge}
                        </Text>
                     </View>

                     {/* Trend */}
                     <View className="flex-row items-center gap-1">
                        <FontAwesome6
                           name={trendIcon}
                           size={10}
                           className={trendColorClass}
                        />
                        <Text className={`text-[11px] font-medium ${trendColorClass}`}>
                           {trendLabel}
                        </Text>
                     </View>
                  </View>
               </View>
            </View>

            {/* Retailer grid */}
            <View className="border-t border-gray-100 pt-4 mb-4">
               <View className="flex-row justify-between gap-3 text-center">
                  {normalizedRetailers.map((retailer, index) => (
                     <RetailerCard key={`${retailer.name}-${index}`} retailer={retailer} />
                  ))}
               </View>
            </View>

            {/* Actions row */}
            <View className="flex-row items-center gap-2">
               {/* Add button */}
               <AddButton className="flex-1" />

               {/* Add to list */}
               <Pressable className="px-3 py-2.5 rounded-xl border-2 border-gray-200 items-center justify-center">
                  <FontAwesome6 name="list" size={14} color="#4B5563" />
               </Pressable>

               {/* Alert */}
               <Pressable className="px-3 py-2.5 rounded-xl border-2 border-gray-200 items-center justify-center">
                  <FontAwesome6 name="bell" size={14} color="#4B5563" />
               </Pressable>
            </View>
         </View>
      </View>
   );
};

export default ProductCard;
