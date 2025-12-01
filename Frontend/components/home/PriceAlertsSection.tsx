import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export default function PriceAlertsSection() {
   const [emailEnabled, setEmailEnabled] = useState(true);
   const [pushEnabled, setPushEnabled] = useState(false);

   return (
      <View className="bg-light border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
            {/* Header */}
            <View className="mb-10">
               <Text className="text-3xl font-bold text-[#111827] mb-2">
                  Price Alerts & Notifications
               </Text>
               <Text className="text-gray-600">
                  Never miss a deal on your favorite products
               </Text>
            </View>

            {/* Card container */}
            <View className="bg-white border border-gray-200 rounded-2xl p-10 shadow-lg">
               <View className="flex flex-col md:flex-row gap-10">
                  {/* Left column: Active alerts */}
                  <View className="flex-1">
                     {/* Section header */}
                     <View className="flex-row items-center gap-4 mb-8">
                        <View className="w-14 h-14 bg-gradient-to-br from-green-50 to-green-100 from-opacity-10 to-opacity-10 rounded-xl flex items-center justify-center">
                           <FontAwesome6 name="bell" size={20} color="#10B981" solid />
                        </View>
                        <View>
                           <Text className="text-lg font-bold text-[#111827]">
                              Active Alerts
                           </Text>
                           <Text className="text-sm text-gray-600">
                              You have 5 price alerts set
                           </Text>
                        </View>
                     </View>

                     <View className="space-y-4">
                        {/* Alert 1 */}
                        <View className="flex-row items-center justify-between p-5 bg-light rounded-xl border border-gray-100">
                           <View className="flex-row items-center gap-3">
                              <View className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                                 <FontAwesome6 name="mug-hot" size={18} color="#6B7280" />
                              </View>
                              <View>
                                 <Text className="text-sm font-semibold text-[#111827]">
                                    Coffee Beans 1kg
                                 </Text>
                                 <Text className="text-xs text-gray-500">
                                    Alert when under $20.00
                                 </Text>
                              </View>
                           </View>
                           <Pressable className="px-2 hover:opacity-80">
                              <FontAwesome6
                                 name="trash"
                                 size={14}
                                 className="text-gray-400 hover:text-red-600"
                              />
                           </Pressable>
                        </View>

                        {/* Alert 2 */}
                        <View className="flex-row items-center justify-between p-5 bg-light rounded-xl border border-gray-100">
                           <View className="flex-row items-center gap-3">
                              <View className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                                 <FontAwesome6 name="bottle-droplet" size={18} color="#6B7280" />
                              </View>
                              <View>
                                 <Text className="text-sm font-semibold text-[#111827]">
                                    Olive Oil 1L
                                 </Text>
                                 <Text className="text-xs text-gray-500">
                                    Alert when under $12.00
                                 </Text>
                              </View>
                           </View>
                           <Pressable className="px-2 hover:opacity-80">
                              <FontAwesome6
                                 name="trash"
                                 size={14}
                                 className="text-gray-400 hover:text-red-600"
                              />
                           </Pressable>
                        </View>

                        {/* Alert 3 highlighted */}
                        <View className="flex-row items-center justify-between p-5 bg-gradient-to-r from-primary_green/5 to-secondary_green/5 from-opacity-10 to-opacity-10 rounded-xl border border-primary_green/20 border-opacity-30">
                           <View className="flex-row items-center gap-3">
                              <View className="w-12 h-12 bg-gradient-to-br from-primary_green to-secondary_green rounded-lg flex items-center justify-center">
                                 <FontAwesome6
                                    name="spray-can-sparkles"
                                    size={18}
                                    color="#FFFFFF"
                                 />
                              </View>
                              <View>
                                 <Text className="text-sm font-semibold text-[#111827]">
                                    Laundry Detergent 2L
                                 </Text>
                                 <Text className="text-xs text-primary_green font-semibold">
                                    Price dropped to $9.50!
                                 </Text>
                              </View>
                           </View>
                           <Pressable className="px-4 py-2 bg-gradient-to-r from-primary_green to-secondary_green rounded-lg shadow-md">
                              <Text className="text-xs font-semibold text-white">
                                 View
                              </Text>
                           </Pressable>
                        </View>
                     </View>
                  </View>

                  {/* Right column: Set new alert */}
                  <View className="flex-1">
                     {/* Section header */}
                     <View className="flex-row items-center gap-4 mb-8">
                        <View className="w-14 h-14 bg-gradient-to-br from-green-50 to-green-100 from-opacity-10 to-opacity-10 rounded-xl flex items-center justify-center">
                           <FontAwesome6 name="chart-line" size={20} color="#10B981" />
                        </View>
                        <View>
                           <Text className="text-lg font-bold text-[#111827]">
                              Set New Alert
                           </Text>
                           <Text className="text-sm text-gray-600">
                              Track prices on any product
                           </Text>
                        </View>
                     </View>

                     <View className="space-y-5">
                        {/* Product name */}
                        <View>
                           <Text className="block text-sm text-gray-700 font-semibold mb-2">
                              Product Name
                           </Text>
                           <TextInput
                              placeholder="Search for a product..."
                              placeholderTextColor="#9CA3AF"
                              className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl text-sm text-[#111827] focus:border-primary"
                           />
                        </View>

                        {/* Target price */}
                        <View>
                           <Text className="block text-sm text-gray-700 font-semibold mb-2">
                              Target Price
                           </Text>
                           <View className="relative">
                              <Text className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                                 $
                              </Text>
                              <TextInput
                                 placeholder="0.00"
                                 placeholderTextColor="#9CA3AF"
                                 keyboardType="numeric"
                                 className="w-full pl-10 pr-5 py-3 border-2 border-gray-200 rounded-xl text-sm text-[#111827] focus:border-primary"
                              />
                           </View>
                        </View>

                        {/* Notification methods */}
                        <View>
                           <Text className="block text-sm text-gray-700 font-semibold mb-3">
                              Notification Method
                           </Text>
                           <View className="space-y-3">
                              {/* Email notifications */}
                              <Pressable
                                 className="flex-row items-center gap-3"
                                 onPress={() => setEmailEnabled(!emailEnabled)}
                              >
                                 <View
                                    className={`w-5 h-5 rounded border items-center justify-center ${emailEnabled
                                       ? "bg-primary_green border-primary_green"
                                       : "bg-white border-gray-300"
                                       }`}
                                 >
                                    {emailEnabled && (
                                       <FontAwesome6
                                          name="check"
                                          size={10}
                                          color="#FFFFFF"
                                       />
                                    )}
                                 </View>
                                 <Text className="text-sm text-gray-700">
                                    Email notifications
                                 </Text>
                              </Pressable>

                              {/* Push notifications */}
                              <Pressable
                                 className="flex-row items-center gap-3"
                                 onPress={() => setPushEnabled(!pushEnabled)}
                              >
                                 <View
                                    className={`w-5 h-5 rounded border items-center justify-center ${pushEnabled
                                       ? "bg-primary_green border-primary_green"
                                       : "bg-white border-gray-300"
                                       }`}
                                 >
                                    {pushEnabled && (
                                       <FontAwesome6
                                          name="check"
                                          size={10}
                                          color="#FFFFFF"
                                       />
                                    )}
                                 </View>
                                 <Text className="text-sm text-gray-700">
                                    Push notifications
                                 </Text>
                              </Pressable>
                           </View>
                        </View>

                        {/* Submit button */}
                        <Pressable className="w-full py-4 bg-gradient-to-r from-primary_green to-secondary_green rounded-xl items-center justify-center mt-2">
                           <Text className="text-white font-semibold">
                              Create Alert
                           </Text>
                        </Pressable>
                     </View>
                  </View>
               </View>
            </View>
         </View>
      </View>
   );
}
