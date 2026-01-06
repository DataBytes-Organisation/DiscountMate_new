import React from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export default function SmartListsSection() {
   return (
      <View className="bg-white border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
            {/* Header */}
            <View className="mb-10">
               <Text className="text-3xl font-bold text-[#111827] mb-2">
                  Smart Shopping Lists
               </Text>
               <Text className="text-gray-600">
                  Create and manage your shopping lists for better savings
               </Text>
            </View>

            {/* Cards */}
            <View className="flex-row flex-wrap -mx-3">
               {/* Create new list card */}
               <Pressable className="w-full md:w-1/3 px-3 mb-6">
                  <View className="bg-gradient-to-br from-light to-white border-2 border-dashed border-gray-300 rounded-2xl p-10 flex-1 items-center justify-center text-center hover:border-primary_green hover:bg-secondary_green transition-all">
                     <View className="w-20 h-20 bg-gradient-to-br from-green-50 to-green-100 rounded-full flex items-center justify-center mb-5">
                        <FontAwesome6 name="plus" size={32} className="text-primary" />
                     </View>
                     <Text className="text-lg font-bold text-[#111827] mb-2">
                        Create New List
                     </Text>
                     <Text className="text-sm text-gray-600">
                        Start building your custom shopping list
                     </Text>
                  </View>
               </Pressable>

               {/* Weekly Essentials */}
               <Pressable className="w-full md:w-1/3 px-3 mb-6">
                  <View className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl transition-all">
                     <View className="flex-row items-center justify-between mb-4">
                        <Text className="text-lg font-bold text-[#111827]">
                           Weekly Essentials
                        </Text>
                        <Pressable>
                           <FontAwesome6
                              name="ellipsis-vertical"
                              size={16}
                              className="text-gray-400 hover:text-primary_green transition-colors"
                           />
                        </Pressable>
                     </View>

                     <View className="space-y-3 mb-5">
                        <View className="flex-row items-center justify-between text-sm">
                           <Text className="text-gray-600 font-medium">12 items</Text>
                           <Text className="text-primary_green font-bold">Save $8.40</Text>
                        </View>

                        <View className="flex-row items-center gap-2">
                           <View className="flex-row -space-x-2">
                              <View className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center shadow-sm">
                                 <Text className="text-lg">🥛</Text>
                              </View>
                              <View className="w-10 h-10 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-lg flex items-center justify-center shadow-sm">
                                 <Text className="text-lg">🍞</Text>
                              </View>
                              <View className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg flex items-center justify-center shadow-sm">
                                 <Text className="text-lg">🥚</Text>
                              </View>
                           </View>
                           <Text className="text-xs text-gray-500 font-medium">
                              +9 more
                           </Text>
                        </View>
                     </View>

                     <Pressable className="w-full py-3 bg-gradient-to-r from-primary_green to-secondary_green rounded-xl items-center justify-center hover:shadow-lg transition-all">
                        <Text className="text-sm font-semibold text-white">
                           View List
                        </Text>
                     </Pressable>
                  </View>
               </Pressable>

               {/* Monthly Stock-up */}
               <Pressable className="w-full md:w-1/3 px-3 mb-6">
                  <View className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl transition-all">
                     <View className="flex-row items-center justify-between mb-4">
                        <Text className="text-lg font-bold text-[#111827]">
                           Monthly Stock-up
                        </Text>
                        <Pressable>
                           <FontAwesome6
                              name="ellipsis-vertical"
                              size={16}
                              className="text-gray-400 hover:text-primary_green transition-colors"
                           />
                        </Pressable>
                     </View>

                     <View className="space-y-3 mb-5">
                        <View className="flex-row items-center justify-between text-sm">
                           <Text className="text-gray-600 font-medium">8 items</Text>
                           <Text className="text-primary_green font-bold">Save $15.20</Text>
                        </View>

                        <View className="flex-row items-center gap-2">
                           <View className="flex-row -space-x-2">
                              <View className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center shadow-sm">
                                 <Text className="text-lg">🧻</Text>
                              </View>
                              <View className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center shadow-sm">
                                 <Text className="text-lg">🧼</Text>
                              </View>
                              <View className="w-10 h-10 bg-gradient-to-br from-red-100 to-red-200 rounded-lg flex items-center justify-center shadow-sm">
                                 <Text className="text-lg">☕</Text>
                              </View>
                           </View>
                           <Text className="text-xs text-gray-500 font-medium">
                              +5 more
                           </Text>
                        </View>
                     </View>

                     <Pressable className="w-full py-3 bg-gradient-to-r from-primary_green to-secondary_green rounded-xl items-center justify-center hover:shadow-lg transition-all">
                        <Text className="text-sm font-semibold text-white">
                           View List
                        </Text>
                     </Pressable>
                  </View>
               </Pressable>
            </View>
         </View>
      </View>
   );
}
