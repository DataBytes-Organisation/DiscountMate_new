import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Image } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useCart } from "../../app/(tabs)/CartContext";

type StoreKey = "coles" | "woolworths" | "aldi";

type StorePrice = {
   price: number;
   oldPrice?: number;
   unitPrice?: string;
};

type ProductRow = {
   id: string;
   name: string;
   subtitle: string;
   imageUrl?: string; // optional, fallback icon if missing
   stores: Record<StoreKey, StorePrice>;
};

export default function ProductComparisonSection() {
   const [searchQuery, setSearchQuery] = useState("");
   const { addToCart } = useCart();

   const data: ProductRow[] = [
      {
         id: "1",
         name: "Milk Full Cream 2L",
         subtitle: "Fresh dairy milk",
         stores: {
            coles: { price: 3.8, oldPrice: 5.0, unitPrice: "$1.90/L" },
            woolworths: { price: 4.2, oldPrice: 5.0, unitPrice: "$2.10/L" },
            aldi: { price: 3.5, oldPrice: 4.7, unitPrice: "$1.75/L" },
         },
      },
      {
         id: "2",
         name: "White Bread 700g",
         subtitle: "Soft white sandwich",
         stores: {
            coles: { price: 2.5, oldPrice: 3.35, unitPrice: "$3.57/kg" },
            woolworths: { price: 2.8, oldPrice: 3.2, unitPrice: "$4.00/kg" },
            aldi: { price: 2.9, oldPrice: 3.25, unitPrice: "$4.14/kg" },
         },
      },
      {
         id: "3",
         name: "Cheddar Cheese Block 500g",
         subtitle: "Tasty mature cheddar",
         stores: {
            coles: { price: 7.5, oldPrice: 9.0, unitPrice: "$15.00/kg" },
            woolworths: { price: 6.8, oldPrice: 9.1, unitPrice: "$13.60/kg" },
            aldi: { price: 7.2, oldPrice: 8.5, unitPrice: "$14.40/kg" },
         },
      },
      {
         id: "4",
         name: "Coffee Beans 1kg",
         subtitle: "Premium arabica",
         stores: {
            coles: { price: 22.0, oldPrice: 26.5, unitPrice: "$22.00/kg" },
            woolworths: { price: 21.5, oldPrice: 26.0, unitPrice: "$21.50/kg" },
            aldi: { price: 23.9, oldPrice: 25.5, unitPrice: "$23.90/kg" },
         },
      },
   ];

   const filtered = useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return data;
      return data.filter((p) => p.name.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q));
   }, [searchQuery]);

   const computeBestDeal = (row: ProductRow) => {
      const entries = Object.entries(row.stores) as [StoreKey, StorePrice][];
      entries.sort((a, b) => a[1].price - b[1].price);
      const best = entries[0];
      const highest = entries[entries.length - 1];
      return {
         bestStore: best[0],
         bestPrice: best[1].price,
         highestPrice: highest[1].price,
         savings: Math.max(0, highest[1].price - best[1].price),
      };
   };

   const storeLabel = (key: StoreKey) => {
      if (key === "coles") return "Coles";
      if (key === "woolworths") return "Woolworths";
      return "Aldi";
   };

   const storeKeyOrder: StoreKey[] = ["coles", "woolworths", "aldi"];

   return (
      <View className="px-4 md:px-8 py-8 bg-[#F9FAFB]">
         <View className="max-w-7xl mx-auto">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
               <Text className="text-2xl font-bold text-gray-900">Compare Products</Text>

               <Pressable className="flex-row items-center gap-2 px-4 py-2.5 rounded-xl border border-primary_green bg-white">
                  <FontAwesome6 name="plus" size={14} color="#10B981" />
                  <Text className="text-primary_green font-semibold text-sm">Add Product to Compare</Text>
               </Pressable>
            </View>

            {/* Search */}
            <View className="mb-6">
               <View className="flex-row items-center bg-white rounded-2xl border border-gray-200 px-4 py-3">
                  <FontAwesome6 name="magnifying-glass" size={16} color="#9CA3AF" />
                  <TextInput
                     placeholder="Search products to compare..."
                     placeholderTextColor="#9CA3AF"
                     value={searchQuery}
                     onChangeText={setSearchQuery}
                     className="flex-1 ml-3 text-gray-700"
                  />
               </View>
            </View>

            {/* Tips (always visible, matches mock) */}
            <View className="mb-6 bg-blue-50 rounded-2xl border border-blue-200 p-5">
               <View className="flex-row items-center gap-4 mb-4">
                  <View className="w-12 h-12 rounded-2xl bg-indigo-500 items-center justify-center shadow-sm">
                     <FontAwesome6 name="lightbulb" size={18} color="#FFFFFF" />
                  </View>
                  <Text className="text-base font-bold text-gray-900">Quick Comparison Tips</Text>
               </View>

               <View className="gap-3">
                  {[
                     "Add up to 6 products to compare side-by-side across all retailers",
                     "View unit prices, total savings, and price trends for each product",
                     "Export comparison data or share with friends and family",
                  ].map((t) => (
                     <View key={t} className="flex-row items-start gap-3">
                        <View className="w-6 h-6 rounded-full bg-primary_green items-center justify-center mt-0.5">
                           <FontAwesome6 name="check" size={12} color="#FFFFFF" />
                        </View>
                        <Text className="text-sm text-gray-700 flex-1">{t}</Text>
                     </View>
                  ))}
               </View>
            </View>

            {/* Table */}
            <View className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
               <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="min-w-full">
                     {/* Header row */}
                     <View className="flex-row bg-gray-50 border-b border-gray-200">
                        <HeaderCell title="Product" width={320} />
                        <HeaderCell title="Coles" width={170} />
                        <HeaderCell title="Woolworths" width={190} />
                        <HeaderCell title="Aldi" width={170} />
                        <HeaderCell title="Best Deal" width={170} />
                        <HeaderCell title="Savings" width={160} />
                        <HeaderCell title="Actions" width={140} isLast />
                     </View>

                     {/* Rows */}
                     {filtered.map((row, idx) => {
                        const best = computeBestDeal(row);

                        return (
                           <View
                              key={row.id}
                              className={[
                                 "flex-row",
                                 idx < filtered.length - 1 ? "border-b border-gray-100" : "",
                              ].join(" ")}
                           >
                              {/* Product cell */}
                              <View className="w-[320px] px-4 py-5">
                                 <View className="flex-row items-center gap-3">
                                    <View className="w-12 h-12 rounded-xl bg-gray-100 items-center justify-center overflow-hidden">
                                       {row.imageUrl ? (
                                          <Image source={{ uri: row.imageUrl }} className="w-full h-full" resizeMode="cover" />
                                       ) : (
                                          <FontAwesome6 name="bag-shopping" size={18} color="#9CA3AF" />
                                       )}
                                    </View>
                                    <View className="flex-1">
                                       <Text className="font-semibold text-gray-900">{row.name}</Text>
                                       <Text className="text-xs text-gray-500 mt-1">{row.subtitle}</Text>
                                    </View>
                                 </View>
                              </View>

                              {/* Store cells */}
                              {storeKeyOrder.map((storeKey) => {
                                 const s = row.stores[storeKey];
                                 const isLowest = storeKey === best.bestStore;

                                 return (
                                    <View key={storeKey} className="w-[170px] px-4 py-5">
                                       <View
                                          className={[
                                             "rounded-2xl px-4 py-3",
                                             isLowest ? "bg-primary_green" : "bg-transparent",
                                          ].join(" ")}
                                       >
                                          <Text
                                             className={[
                                                "text-lg font-bold",
                                                isLowest ? "text-white" : "text-gray-900",
                                             ].join(" ")}
                                          >
                                             ${s.price.toFixed(2)}
                                          </Text>

                                          {s.oldPrice != null && (
                                             <Text
                                                className={[
                                                   "text-xs line-through mt-1",
                                                   isLowest ? "text-white/70" : "text-gray-400",
                                                ].join(" ")}
                                             >
                                                ${s.oldPrice.toFixed(2)}
                                             </Text>
                                          )}

                                          {s.unitPrice && (
                                             <Text
                                                className={[
                                                   "text-xs mt-1",
                                                   isLowest ? "text-white/90" : "text-gray-600",
                                                ].join(" ")}
                                             >
                                                {s.unitPrice}
                                             </Text>
                                          )}
                                       </View>
                                    </View>
                                 );
                              })}

                              {/* Best deal */}
                              <View className="w-[170px] px-4 py-5 items-center justify-center">
                                 <View className="flex-row items-center gap-2 px-4 py-2 rounded-full bg-amber-600 shadow-sm">
                                    <FontAwesome6 name="trophy" size={12} color="#FFFFFF" />
                                    <Text className="text-white text-sm font-semibold">
                                       {storeLabel(best.bestStore)}
                                    </Text>
                                 </View>
                              </View>

                              {/* Savings */}
                              <View className="w-[160px] px-4 py-5 items-center justify-center">
                                 <Text className="text-lg font-bold text-primary_green">
                                    ${best.savings.toFixed(2)}
                                 </Text>
                                 <Text className="text-xs text-gray-500 mt-1">vs highest</Text>
                              </View>

                              {/* Actions */}
                              <View className="w-[140px] px-4 py-5 items-center justify-center">
                                 <Pressable
                                    className="bg-primary_green px-6 py-2.5 rounded-xl shadow-sm"
                                    onPress={() => {
                                       addToCart({
                                          id: row.id,
                                          name: row.name,
                                          price: best.bestPrice,
                                          store: storeLabel(best.bestStore),
                                       });
                                    }}
                                 >
                                    <Text className="text-white font-semibold text-sm">Add</Text>
                                 </Pressable>
                              </View>
                           </View>
                        );
                     })}
                  </View>
               </ScrollView>
            </View>

            {/* Footer bar (matches mock) */}
            <ComparisonFooterBar
               productCount={filtered.length}
               retailerCount={3}
            />
         </View>
      </View>
   );
}

function HeaderCell({
   title,
   width,
   isLast,
}: {
   title: string;
   width: number;
   isLast?: boolean;
}) {
   return (
      <View
         className={[
            "px-4 py-4",
            isLast ? "" : "border-r border-gray-200",
         ].join(" ")}
         style={{ width }}
      >
         <Text className="font-semibold text-gray-700">{title}</Text>
      </View>
   );
}
function ComparisonFooterBar({
   productCount,
   retailerCount,
}: {
   productCount: number;
   retailerCount: number;
}) {
   return (
      <View className="flex-row items-center justify-between mt-6">
         <Text className="text-sm text-gray-600">
            Comparing <Text className="font-semibold text-gray-900">{productCount}</Text>{" "}
            products across <Text className="font-semibold text-gray-900">{retailerCount}</Text>{" "}
            retailers
         </Text>

         <View className="flex-row items-center gap-3">
            <Pressable className="flex-row items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white">
               <FontAwesome6 name="download" size={14} color="#374151" />
               <Text className="text-sm font-semibold text-gray-800">Export Comparison</Text>
            </Pressable>

            <Pressable className="flex-row items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white">
               <FontAwesome6 name="share-nodes" size={14} color="#374151" />
               <Text className="text-sm font-semibold text-gray-800">Share</Text>
            </Pressable>

            <Pressable className="flex-row items-center gap-2 px-4 py-2.5 rounded-xl bg-primary_green">
               <FontAwesome6 name="print" size={14} color="#FFFFFF" />
               <Text className="text-sm font-semibold text-white">Print</Text>
            </Pressable>
         </View>
      </View>
   );
}

