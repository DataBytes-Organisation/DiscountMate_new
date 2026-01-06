// Frontend/components/product/ProductCard.tsx
import React from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import RetailerCard, { Retailer } from "./RetailerCard";
import AddButton from "../common/AddButton";
import { useRouter } from "expo-router";
import { useCart } from "../../app/(tabs)/CartContext";
export type TrendTone = "green" | "red" | "orange" | "neutral";

export type Product = {
   id: string;
   name: string;
   subtitle: string;
   category?: string;
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
   const router = useRouter();
   const { addToCart } = useCart();
   const { id, name, subtitle, icon, badge, trendLabel, trendTone, retailers } = product;

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

   // Calculate maximum savings from all retailers
   const maxSavings = (() => {
      let maxSavingsValue = 0;

      normalizedRetailers.forEach(retailer => {
         if (retailer.originalPrice && retailer.price) {
            const original = parseFloat(retailer.originalPrice.replace(/[^0-9.]/g, ""));
            const current = parseFloat(retailer.price.replace(/[^0-9.]/g, ""));

            if (!isNaN(original) && !isNaN(current) && original > current) {
               const savings = original - current;
               maxSavingsValue = Math.max(maxSavingsValue, savings);
            }
         }
      });

      return maxSavingsValue > 0 ? `Save $${maxSavingsValue.toFixed(2)}` : badge;
   })();

   const trendIcon = getTrendIcon(trendTone);
   const trendColorClass = getTrendColorClass(trendTone);

   const handleOpenDetails = () => {
      // Navigate to the dedicated product detail route: app/(product)/product/[id].tsx
      // Pass both the ID and name so the detail page can show the correct title
      router.push({
         pathname: "/product/[id]",
         params: { id, name },
      });
   };

   const handleAddToCart = () => {
      // Find the cheapest retailer to get the best price
      const cheapestRetailer = normalizedRetailers.find(r => r.isCheapest) || normalizedRetailers[0];
      const price = cheapestRetailer?.price
         ? parseFloat(cheapestRetailer.price.replace(/[^0-9.]/g, ""))
         : 0;

      addToCart({
         id: id,
         name: name,
         price: price,
         store: cheapestRetailer?.name,
      });
   };

   return (
      <Pressable
         className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300"
         onPress={handleOpenDetails}
      >
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
                           {maxSavings}
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
               <AddButton className="flex-1" onPress={handleAddToCart} />

               {/* Add to favourites */}
               <Pressable
                  className="px-3 py-2.5 rounded-xl border-2 border-gray-200 items-center justify-center"
                  onPress={(e) => {
                     e.stopPropagation();
                  }}
               >
                  <FontAwesome6 name="heart" size={14} color="#4B5563" />
               </Pressable>

               {/* Alert */}
               <Pressable
                  className="px-3 py-2.5 rounded-xl border-2 border-gray-200 items-center justify-center"
                  onPress={(e) => {
                     e.stopPropagation();
                  }}
               >
                  <FontAwesome6 name="bell" size={14} color="#4B5563" />
               </Pressable>
            </View>
         </View>
      </Pressable>
   );
};

export default ProductCard;
