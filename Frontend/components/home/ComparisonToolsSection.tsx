import React from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export default function ComparisonToolsSection() {
   return (
      <View className="bg-white border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
            {/* Header */}
            <View className="mb-10">
               <Text className="text-3xl font-bold text-[#111827] mb-2">
                  Comparison Tools
               </Text>
               <Text className="text-gray-600">
                  Advanced features to help you save more
               </Text>
            </View>

            {/* Two-column grid */}
            <View className="flex flex-col md:flex-row gap-6">
               {/* Unit Price Calculator card */}
               <View className="w-full md:w-1/2">
                  <View className="bg-gradient-to-br from-light to-white border border-gray-200 rounded-2xl p-10 hover:shadow-xl transition-all">
                     {/* Header row */}
                     <View className="flex-row items-start gap-5 mb-8">
                        <View className="w-16 h-16 bg-gradient-to-br from-primary_green to-secondary_green rounded-xl flex items-center justify-center shadow-lg">
                           <FontAwesome6 name="calculator" size={24} color="#FFFFFF" />
                        </View>
                        <View className="flex-1">
                           <Text className="text-xl text-[#111827] font-bold mb-2">
                              Unit Price Calculator
                           </Text>
                           <Text className="text-sm text-gray-600">
                              Compare products by weight, volume, or quantity to find the best value
                           </Text>
                        </View>
                     </View>

                     {/* Example rows */}
                     <View className="space-y-4">
                        <View className="flex-row items-center justify-between p-5 bg-white border border-gray-200 rounded-xl">
                           <View>
                              <Text className="text-sm text-[#111827] font-semibold">
                                 500g @ $7.50
                              </Text>
                              <Text className="text-xs text-gray-500">
                                 $15.00 per kg
                              </Text>
                           </View>
                           <Text className="text-lg text-[#111827] font-bold">
                              $15.00/kg
                           </Text>
                        </View>

                        <View className="flex-row items-center justify-between p-5 bg-gradient-to-r from-primary_green/10 to-secondary_green/10 border border-primary_green/30 rounded-xl">
                           <View>
                              <Text className="text-sm text-[#111827] font-semibold">
                                 1kg @ $12.00
                              </Text>
                              <Text className="text-xs text-primary_green font-semibold">
                                 Best value - Save $3.00 per kg
                              </Text>
                           </View>
                           <Text className="text-lg text-primary_green font-bold">
                              $12.00/kg
                           </Text>
                        </View>
                     </View>

                     {/* CTA */}
                     <Pressable className="w-full mt-8 py-4 bg-gradient-to-r from-primary_green to-secondary_green rounded-xl items-center justify-center hover:shadow-lg transition-all">
                        <Text className="text-white font-semibold">
                           Open Calculator
                        </Text>
                     </Pressable>
                  </View>
               </View>

               {/* Grocery List Optimizer card */}
               <View className="w-full md:w-1/2">
                  <View className="bg-gradient-to-br from-light to-white border border-gray-200 rounded-2xl p-10 hover:shadow-xl transition-all">
                     {/* Header row */}
                     <View className="flex-row items-start gap-5 mb-8">
                        <View className="w-16 h-16 bg-gradient-to-br from-primary_green to-secondary_green rounded-xl flex items-center justify-center shadow-lg">
                           <FontAwesome6 name="list" size={24} color="#FFFFFF" />
                        </View>
                        <View className="flex-1">
                           <Text className="text-xl text-[#111827] font-bold mb-2">
                              Grocery List Optimizer
                           </Text>
                           <Text className="text-sm text-gray-600">
                              Split your shopping across stores to maximize savings
                           </Text>
                        </View>
                     </View>

                     <View className="space-y-4">
                        {/* Current grocery list */}
                        <View className="p-5 bg-white border border-gray-200 rounded-xl">
                           <View className="flex-row items-center justify-between mb-3">
                              <Text className="text-sm text-[#111827] font-semibold">
                                 Current grocery list
                              </Text>
                              <Text className="text-sm text-gray-600 font-semibold">
                                 $87.50
                              </Text>
                           </View>
                           <View className="w-full bg-gray-200 rounded-full h-3">
                              <View
                                 className="bg-gray-400 h-3 rounded-full"
                                 style={{ width: "100%" }}
                              />
                           </View>
                        </View>

                        {/* Optimized split */}
                        <View className="p-5 bg-gradient-to-r from-primary_green/10 to-secondary_green/10 border border-primary_green/30 rounded-xl">
                           <View className="flex-row items-center justify-between mb-3">
                              <Text className="text-sm text-[#111827] font-semibold">
                                 Optimized split
                              </Text>
                              <Text className="text-sm text-primary_green font-bold">
                                 $74.20
                              </Text>
                           </View>

                           <View className="w-full bg-gray-200 rounded-full h-3 mb-3">
                              <View
                                 className="bg-gradient-to-r from-primary_green to-secondary_green h-3 rounded-full"
                                 style={{ width: "85%" }}
                              />
                           </View>

                           <Text className="text-xs text-primary_green font-semibold">
                              Save $13.30 by shopping at 2 stores
                           </Text>
                        </View>
                     </View>

                     {/* CTA */}
                     <Pressable className="w-full mt-8 py-4 bg-gradient-to-r from-primary_green to-secondary_green rounded-xl items-center justify-center hover:shadow-lg transition-all">
                        <Text className="text-white font-semibold">
                           Optimize My Grocery List
                        </Text>
                     </Pressable>
                  </View>
               </View>
            </View>
         </View>
      </View>
   );
}
