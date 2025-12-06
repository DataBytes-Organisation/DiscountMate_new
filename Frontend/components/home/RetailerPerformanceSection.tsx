import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

type RetailerRow = {
   id: string;
   name: string;
   code: string;
   avatarClasses: string;
   codeColorClasses: string;
   priceIndex: string;
   priceIndexColorClasses: string;
   specials: string;
   discount: string;
   discountColorClasses: string;
   trendLabel: string;
   trendIcon?: string;
   trendColorClasses: string;
   rowClasses: string;
   highlight?: boolean;
};

const retailers: RetailerRow[] = [
   {
      id: "coles",
      name: "Coles",
      code: "C",
      avatarClasses:
         "w-12 h-12 bg-gradient-to-br from-red-100 to-red-200 rounded-xl flex items-center justify-center",
      codeColorClasses: "text-sm text-red-600 font-bold",
      priceIndex: "98.5",
      priceIndexColorClasses: "text-lg text-[#111827] font-bold",
      specials: "342 items",
      discount: "18.5%",
      discountColorClasses: "text-sm text-primary_green font-bold",
      trendLabel: "Improving",
      trendIcon: "arrow-trend-down",
      trendColorClasses: "flex-row items-center gap-2 text-sm text-primary_green font-semibold",
      rowClasses: "flex-row items-center px-8 py-5 hover:bg-light transition-colors",
   },
   {
      id: "woolworths",
      name: "Woolworths",
      code: "W",
      avatarClasses:
         "w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center",
      codeColorClasses: "text-sm text-green-600 font-bold",
      priceIndex: "101.2",
      priceIndexColorClasses: "text-lg text-[#111827] font-bold",
      specials: "318 items",
      discount: "16.2%",
      discountColorClasses: "text-sm text-primary_green font-bold",
      trendLabel: "Stable",
      trendIcon: undefined,
      trendColorClasses: "flex-row items-center gap-2 text-sm text-gray-600 font-semibold",
      rowClasses: "flex-row items-center px-8 py-5 hover:bg-light transition-colors",
   },
   {
      id: "aldi",
      name: "Aldi",
      code: "A",
      avatarClasses:
         "w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl flex items-center justify-center shadow-md",
      codeColorClasses: "text-sm text-white font-bold",
      priceIndex: "94.8",
      priceIndexColorClasses: "text-lg text-primary_green font-bold",
      specials: "289 items",
      discount: "21.3%",
      discountColorClasses: "text-sm text-primary_green font-bold",
      trendLabel: "Improving",
      trendIcon: "arrow-trend-down",
      trendColorClasses: "flex-row items-center gap-2 text-sm text-primary_green font-semibold",
      rowClasses:
         "flex-row items-center px-8 py-5 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 transition-colors",
      highlight: true,
   },
];

export default function RetailerPerformanceSection() {
   return (
      <View className="bg-[#F9FAFB] border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
            {/* Header */}
            <View className="mb-10">
               <Text className="text-3xl font-bold text-[#111827] mb-2">
                  Retailer Performance
               </Text>
               <Text className="text-gray-600">
                  See how retailers compare this week
               </Text>
            </View>

            {/* Table container */}
            <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-lg">
               <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ minWidth: "100%" }}
               >
                  <View className="w-full">
                     {/* Header row */}
                     <View className="flex-row bg-gradient-to-r from-light to-white border-b border-gray-200">
                        <View className="px-8 py-5 flex-[2]">
                           <Text className="text-sm text-[#111827] font-bold">
                              Retailer
                           </Text>
                        </View>
                        <View className="px-8 py-5 flex-1">
                           <Text className="text-sm text-[#111827] font-bold">
                              Avg. Price Index
                           </Text>
                        </View>
                        <View className="px-8 py-5 flex-1">
                           <Text className="text-sm text-[#111827] font-bold">
                              Items on Special
                           </Text>
                        </View>
                        <View className="px-8 py-5 flex-1">
                           <Text className="text-sm text-[#111827] font-bold">
                              Avg. Discount
                           </Text>
                        </View>
                        <View className="px-8 py-5 flex-1">
                           <Text className="text-sm text-[#111827] font-bold">
                              Trending
                           </Text>
                        </View>
                        <View className="px-8 py-5 flex-1">
                           <Text className="text-sm text-[#111827] font-bold">
                              Action
                           </Text>
                        </View>
                     </View>

                     {/* Body rows */}
                     {retailers.map((retailer) => (
                        <View
                           key={retailer.id}
                           className={`border-t border-gray-100 ${retailer.rowClasses}`}
                        >
                           {/* Retailer cell */}
                           <View className="flex-[2]">
                              <View className="flex-row items-center gap-4">
                                 <View className={retailer.avatarClasses}>
                                    <Text className={retailer.codeColorClasses}>
                                       {retailer.code}
                                    </Text>
                                 </View>
                                 <View>
                                    <View className="flex-row items-center gap-2">
                                       <Text className="text-[#111827] font-semibold">
                                          {retailer.name}
                                       </Text>
                                       {retailer.highlight && (
                                          <View className="px-3 py-1 bg-gradient-to-r from-primary_green to-secondary_green rounded-full">
                                             <Text className="text-xs text-white font-bold">
                                                Best Value
                                             </Text>
                                          </View>
                                       )}
                                    </View>
                                 </View>
                              </View>
                           </View>

                           {/* Avg. Price Index */}
                           <View className="flex-1">
                              <View className="flex-row items-center gap-2">
                                 <Text className={retailer.priceIndexColorClasses}>
                                    {retailer.priceIndex}
                                 </Text>
                                 <Text className="text-xs text-gray-500">
                                    (baseline: 100)
                                 </Text>
                              </View>
                           </View>

                           {/* Items on Special */}
                           <View className="flex-1">
                              <Text className="text-sm text-[#111827] font-semibold">
                                 {retailer.specials}
                              </Text>
                           </View>

                           {/* Avg. Discount */}
                           <View className="flex-1">
                              <Text className={retailer.discountColorClasses}>
                                 {retailer.discount}
                              </Text>
                           </View>

                           {/* Trending */}
                           <View className="flex-1">
                              <View className={retailer.trendColorClasses}>
                                 {retailer.trendIcon && (
                                    <FontAwesome6
                                       name={retailer.trendIcon}
                                       size={14}
                                       color={
                                          retailer.trendColorClasses.includes("text-primary")
                                             ? "#10B981"
                                             : "#4B5563"
                                       }
                                    />
                                 )}
                                 {!retailer.trendIcon && (
                                    <FontAwesome6 name="minus" size={14} color="#4B5563" />
                                 )}
                                 <Text
                                    className={
                                       retailer.trendColorClasses
                                          .split(" ")
                                          .filter((c) => c.startsWith("text-"))
                                          .join(" ") + " font-semibold ml-1"
                                    }
                                 >
                                    {retailer.trendLabel}
                                 </Text>
                              </View>
                           </View>

                           {/* Action */}
                           <View className="flex-1">
                              <Pressable>
                                 <Text className="text-sm text-primary_green font-semibold underline-offset-2">
                                    View deals
                                 </Text>
                              </Pressable>
                           </View>
                        </View>
                     ))}
                  </View>
               </ScrollView>
            </View>
         </View>
      </View>
   );
}
