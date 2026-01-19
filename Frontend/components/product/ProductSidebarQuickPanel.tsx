import React, { useState } from "react";
import { View, Text, Pressable, TextInput, Image } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

interface ProductSidebarQuickPanelProps {
   productId?: string | string[];
}

export default function ProductSidebarQuickPanel({
   productId,
}: ProductSidebarQuickPanelProps) {
   const [monthlyQuantity, setMonthlyQuantity] = useState("4");

   // Mock data for savings calculation
   const averagePrice = 4.80;
   const cheapestPrice = 3.50;

   const calculateSavings = (qty: string) => {
      const num = parseInt(qty, 10) || 0;
      const monthly = num * (averagePrice - cheapestPrice);
      const yearly = monthly * 12;
      return { monthly, yearly };
   };

   const savings = calculateSavings(monthlyQuantity);

   return (
      <View className="gap-6">
         {/* QUICK ACTIONS */}
         <View className="bg-white rounded-3xl border border-gray-200 p-5">
            <Text className="text-lg font-bold text-gray-900 mb-4">
               Quick Actions
            </Text>

            <View className="gap-3">
               {/* Secondary actions */}
               <QuickActionButton
                  icon="list"
                  label="Add to List"
               />
               <QuickActionButton
                  icon="bell"
                  label="Set Price Alert"
               />
               <QuickActionButton
                  icon="share-nodes"
                  label="Share Product"
               />
            </View>
         </View>

         {/* SAVINGS CALCULATOR */}
         <View className="bg-emerald-50 rounded-3xl p-5">
            <View className="flex-row items-center gap-3 mb-4">
               <View className="w-9 h-9 rounded-2xl bg-white shadow-sm items-center justify-center">
                  <FontAwesome6 name="calculator" size={16} color="#10B981" />
               </View>
               <Text className="text-lg font-bold text-gray-900">
                  Savings Calculator
               </Text>
            </View>

            <View className="mb-4">
               <Text className="text-sm text-gray-700 mb-2">
                  How many do you buy per month?
               </Text>
               <TextInput
                  value={monthlyQuantity}
                  onChangeText={setMonthlyQuantity}
                  keyboardType="numeric"
                  className="bg-white rounded-2xl px-4 py-3 text-gray-900 border border-gray-200"
                  placeholder="4"
               />
            </View>

            <View className="bg-white rounded-2xl px-4 py-3 mb-3">
               <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm text-gray-700">Monthly Savings</Text>
                  <Text className="text-xl font-bold text-primary_green">
                     ${savings.monthly.toFixed(2)}
                  </Text>
               </View>
               <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-gray-700">Yearly Savings</Text>
                  <Text className="text-xl font-bold text-primary_green">
                     ${savings.yearly.toFixed(2)}
                  </Text>
               </View>
            </View>

            <Text className="text-xs text-gray-500">
               Based on buying from the cheapest retailer vs. average price
            </Text>
         </View>

         {/* DELIVERY OPTIONS */}
         <View className="bg-white rounded-3xl border border-gray-200 p-5">
            <View className="flex-row items-center gap-3 mb-4">
               <View className="w-9 h-9 rounded-2xl bg-emerald-50 items-center justify-center">
                  <FontAwesome6 name="truck" size={16} color="#10B981" />
               </View>
               <Text className="text-lg font-bold text-gray-900">
                  Delivery Options
               </Text>
            </View>

            <View className="gap-4">
               {/* Standard */}
               <View>
                  <View className="flex-row items-center gap-2 mb-1">
                     <FontAwesome6 name="box" size={14} color="#10B981" />
                     <Text className="font-semibold text-gray-900">
                        Standard Delivery
                     </Text>
                  </View>
                  <Text className="text-sm text-gray-600">
                     2–3 business days
                  </Text>
                  <Text className="text-sm font-semibold text-primary_green mt-1">
                     Free over $50
                  </Text>
               </View>

               <View className="h-px bg-gray-100" />

               {/* Express */}
               <View>
                  <View className="flex-row items-center gap-2 mb-1">
                     <FontAwesome6 name="bolt" size={14} color="#10B981" />
                     <Text className="font-semibold text-gray-900">
                        Express Delivery
                     </Text>
                  </View>
                  <Text className="text-sm text-gray-600">Next day</Text>
                  <Text className="text-sm font-semibold text-gray-900 mt-1">
                     $9.95
                  </Text>
               </View>

               <View className="h-px bg-gray-100" />

               {/* Click & Collect */}
               <View>
                  <View className="flex-row items-center gap-2 mb-1">
                     <FontAwesome6 name="store" size={14} color="#10B981" />
                     <Text className="font-semibold text-gray-900">
                        Click & Collect
                     </Text>
                  </View>
                  <Text className="text-sm text-gray-600">Ready in 2 hours</Text>
                  <Text className="text-sm font-semibold text-primary_green mt-1">
                     Free
                  </Text>
               </View>
            </View>
         </View>

         {/* RELATED CATEGORIES */}
         <View className="bg-white rounded-3xl border border-gray-200 p-5">
            <Text className="text-lg font-bold text-gray-900 mb-4">
               Related Categories
            </Text>

            <View className="gap-2">
               {["All Dairy Products", "Fresh Milk", "Organic Milk", "Flavored Milk"].map(
                  (cat, idx) => (
                     <Pressable
                        key={cat}
                        className={[
                           "flex-row items-center justify-between px-3 py-3 rounded-2xl bg-gray-50",
                           idx === 0 ? "" : "",
                        ].join(" ")}
                     >
                        <Text className="text-sm text-gray-800">{cat}</Text>
                        <FontAwesome6
                           name="chevron-right"
                           size={12}
                           color="#9CA3AF"
                        />
                     </Pressable>
                  )
               )}
            </View>
         </View>

         {/* RECENTLY VIEWED */}
         <View className="bg-white rounded-3xl border border-gray-200 p-5 mb-6">
            <Text className="text-lg font-bold text-gray-900 mb-4">
               Recently Viewed
            </Text>

            <View className="gap-3">
               {[
                  {
                     name: "White Bread 700g",
                     price: 2.5,
                     image:
                        "https://images.pexels.com/photos/2434/bread-food-healthy-breakfast.jpg",
                  },
                  {
                     name: "Bananas 1kg",
                     price: 2.9,
                     image:
                        "https://images.pexels.com/photos/3820834/pexels-photo-3820834.jpeg",
                  },
                  {
                     name: "Cheddar Cheese 500g",
                     price: 6.8,
                     image:
                        "https://images.pexels.com/photos/4109940/pexels-photo-4109940.jpeg",
                  },
               ].map((item, idx, arr) => (
                  <View
                     key={item.name}
                     className={[
                        "flex-row items-center py-2",
                        idx < arr.length - 1 ? "border-b border-gray-100" : "",
                     ].join(" ")}
                  >
                     <View className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 mr-3">
                        <Image
                           source={{ uri: item.image }}
                           className="w-full h-full"
                           resizeMode="cover"
                        />
                     </View>
                     <View className="flex-1">
                        <Text className="text-sm font-medium text-gray-900">
                           {item.name}
                        </Text>
                        <Text className="text-xs text-primary_green mt-0.5">
                           from ${item.price.toFixed(2)}
                        </Text>
                     </View>
                  </View>
               ))}
            </View>
         </View>
      </View>
   );
}

/** Simple secondary quick action button */
function QuickActionButton({
   icon,
   label,
}: {
   icon: string;
   label: string;
}) {
   return (
      <Pressable className="border border-gray-200 rounded-2xl py-3 px-3 flex-row items-center gap-3 bg-white">
         <FontAwesome6 name={icon as any} size={14} color="#4B5563" />
         <Text className="text-sm font-semibold text-gray-800">{label}</Text>
      </Pressable>
   );
}
