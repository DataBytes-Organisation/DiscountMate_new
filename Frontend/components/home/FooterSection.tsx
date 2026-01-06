import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { FontAwesome, Feather } from "@expo/vector-icons";
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';


interface FooterSectionProps {
   disableEdgeOffset?: boolean;
}

const FooterSection: React.FC<FooterSectionProps> = ({ disableEdgeOffset }) => {
   return (
      <View
         className="bg-dark m-0"
         style={[
            disableEdgeOffset ? undefined : { marginHorizontal: -16 },
            { marginBottom: -24 },
         ]}
      >
         <View className="w-full px-6 md:px-12 py-12">
            {/* Top grid */}
            <View className="flex flex-col gap-10 md:flex-row md:justify-between md:gap-8 mb-10">
               {/* Brand + description + social */}
               <View className="flex-1">
                  <View className="flex flex-row items-center gap-2 mb-6">
                     <View className="w-11 h-11 rounded-lg items-center justify-center bg-gradient-to-br from-primary_green to-secondary_green shadow-md" >
                        <FontAwesome6 name="tag" size={20} color="#FFFFFF" solid />
                     </View>
                     <Text className="text-2xl font-bold text-white">
                        DiscountMate
                     </Text>
                  </View>

                  <Text className="text-sm text-gray-400 mb-6">
                     Your smart shopping companion for finding the best grocery deals
                     across Australia&apos;s leading retailers.
                  </Text>

                  <View className="flex flex-row items-center gap-4">
                     <TouchableOpacity className="w-10 h-10 rounded-lg bg-white/10 items-center justify-center active:bg-primary">
                        <FontAwesome name="facebook" size={18} color="#E5E7EB" />
                     </TouchableOpacity>
                     <TouchableOpacity className="w-10 h-10 rounded-lg bg-white/10 items-center justify-center active:bg-primary">
                        <FontAwesome name="twitter" size={18} color="#E5E7EB" />
                     </TouchableOpacity>
                     <TouchableOpacity className="w-10 h-10 rounded-lg bg-white/10 items-center justify-center active:bg-primary">
                        <FontAwesome name="instagram" size={18} color="#E5E7EB" />
                     </TouchableOpacity>
                  </View>
               </View>

               {/* Quick Links */}
               <View className="flex-1">
                  <Text className="text-white font-bold mb-5">Quick Links</Text>
                  <View className="gap-3">
                     {[
                        "Home",
                        "Compare Prices",
                        "Weekly Specials",
                        "My Lists",
                        "Price Alerts",
                     ].map((item) => (
                        <TouchableOpacity key={item}>
                           <Text className="text-sm text-gray-400 active:text-primary">
                              {item}
                           </Text>
                        </TouchableOpacity>
                     ))}
                  </View>
               </View>

               {/* Support */}
               <View className="flex-1">
                  <Text className="text-white font-bold mb-5">Support</Text>
                  <View className="gap-3">
                     {[
                        "Help Center",
                        "Contact Us",
                        "FAQs",
                        "Privacy Policy",
                        "Terms of Service",
                     ].map((item) => (
                        <TouchableOpacity key={item}>
                           <Text className="text-sm text-gray-400 active:text-primary">
                              {item}
                           </Text>
                        </TouchableOpacity>
                     ))}
                  </View>
               </View>

               {/* Newsletter */}
               <View className="flex-1">
                  <Text className="text-white font-bold mb-5">Newsletter</Text>
                  <Text className="text-sm text-gray-400 mb-5">
                     Subscribe to get weekly deals and exclusive offers.
                  </Text>

                  <View className="flex-row items-center gap-2">
                     <TextInput
                        placeholder="Your email"
                        placeholderTextColor="#9CA3AF"
                        className="flex-1 px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-sm text-white"
                     />
                     <TouchableOpacity className="px-4 py-3 rounded-lg bg-gradient-to-r from-primary_green to-secondary_green items-center justify-center shadow-lg">
                        <FontAwesome6 name="paper-plane" size={15} color="#FFFFFF" solid />
                     </TouchableOpacity>
                  </View>
               </View>
            </View>

            {/* Bottom bar */}
            <View className="border-t border-white/10 pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
               <Text className="text-sm text-gray-400">
                  © 2024 DiscountMate. All rights reserved.
               </Text>

               <View className="flex flex-row items-center gap-6">
                  {["Privacy", "Terms", "Cookies"].map((item) => (
                     <TouchableOpacity key={item}>
                        <Text className="text-sm text-gray-400 active:text-primary">
                           {item}
                        </Text>
                     </TouchableOpacity>
                  ))}
               </View>
            </View>
         </View>
      </View >
   );
};

export default FooterSection;
