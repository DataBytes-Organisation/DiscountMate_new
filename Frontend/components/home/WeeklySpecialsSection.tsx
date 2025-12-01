import React from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import AddButton from "../common/AddButton";

const specials = [
   {
      id: 1,
      icon: "bottle-droplet",
      discount: "50% OFF",
      name: "Premium Olive Oil 1L",
      description: "Extra virgin cold pressed",
      price: "$9.99",
      oldPrice: "$19.99",
      store: "Coles",
      savings: "$10.00",
   },
   {
      id: 2,
      icon: "circle-question",
      discount: "40% OFF",
      name: "Chocolate Block 200g",
      description: "Premium dark chocolate",
      price: "$3.60",
      oldPrice: "$6.00",
      store: "Woolworths",
      savings: "$2.40",
   },
   {
      id: 3,
      icon: "spray-can-sparkles",
      discount: "35% OFF",
      name: "Laundry Detergent 2L",
      description: "Advanced stain removal",
      price: "$9.75",
      oldPrice: "$15.00",
      store: "Aldi",
      savings: "$5.25",
   },
   {
      id: 4,
      icon: "ice-cream",
      discount: "45% OFF",
      name: "Ice Cream Tub 2L",
      description: "Premium vanilla bean",
      price: "$5.50",
      oldPrice: "$10.00",
      store: "Coles",
      savings: "$4.50",
   },
];

export default function WeeklySpecialsSection() {
   return (
      <View className="bg-white border-t border-gray-100">
         <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-10">
               <View>
                  <Text className="text-3xl font-bold text-[#111827] mb-2">
                     This Week&apos;s Top Specials
                  </Text>
                  <Text className="text-gray-600">
                     Handpicked deals with the biggest savings
                  </Text>
               </View>

               <Pressable className="px-8 py-4 rounded-xl bg-[#10B981]">
                  <Text className="text-white font-semibold">
                     View All Specials
                  </Text>
               </Pressable>
            </View>

            {/* Cards */}
            <View className="flex-row flex-wrap -mx-3">
               {specials.map((item) => (
                  <View key={item.id} className="w-full md:w-1/4 px-3 mb-6">
                     <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                        {/* Image / icon area + badge */}
                        <View className="relative">
                           <View className="w-full h-56 bg-gray-100 items-center justify-center">
                              <FontAwesome6
                                 name={item.icon}
                                 size={32}
                                 color="#9CA3AF"
                              />
                           </View>

                           <View className="absolute top-4 right-4">
                              <View className="px-4 py-2 rounded-full bg-red-500">
                                 <Text className="text-white text-xs font-bold">
                                    {item.discount}
                                 </Text>
                              </View>
                           </View>
                        </View>

                        {/* Content */}
                        <View className="p-5">
                           <Text className="text-base font-bold text-[#111827] mb-1">
                              {item.name}
                           </Text>
                           <Text className="text-xs text-gray-500 mb-4">
                              {item.description}
                           </Text>

                           <View className="flex-row items-end justify-between mb-4">
                              <View>
                                 <Text className="text-3xl font-bold text-[#111827]">
                                    {item.price}
                                 </Text>
                                 <Text className="text-sm text-gray-400 line-through">
                                    {item.oldPrice}
                                 </Text>
                              </View>

                              <View className="items-end">
                                 <Text className="text-xs text-gray-500 mb-1">
                                    at {item.store}
                                 </Text>
                                 <Text className="text-xs font-bold text-[#10B981]">
                                    Save {item.savings}
                                 </Text>
                              </View>
                           </View>

                           <View className="mt-2">
                              <AddButton label="Add to Basket" />
                           </View>
                        </View>
                     </View>
                  </View>
               ))}
            </View>
         </View>
      </View>
   );
}
