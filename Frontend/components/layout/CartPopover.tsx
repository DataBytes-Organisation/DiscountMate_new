import React from "react";
import { View, Text, Pressable, Modal, ScrollView, Image } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useRouter } from "expo-router";
import { useCart } from "../../app/(tabs)/CartContext";
import { useShoppingLists } from "../../app/(tabs)/ShoppingListsContext";

type CartPopoverProps = {
   visible: boolean;
   onClose: () => void;
};

export default function CartPopover({ visible, onClose }: CartPopoverProps) {
   const router = useRouter();
   const { cartItems, getTotalItems, updateQuantity } = useCart();
   const { getActiveList } = useShoppingLists();
   const activeListName = getActiveList()?.name ?? "Your Grocery List";

   const totalItems = getTotalItems();
   const totalPrice = cartItems.reduce(
      (sum, item) => sum + item.price * (item.quantity || 1),
      0
   );

   const handleGoToCompare = () => {
      onClose();
      router.push("/(tabs)/my-lists");
   };

   return (
      <Modal
         visible={visible}
         transparent
         animationType="fade"
         onRequestClose={onClose}
      >
         <Pressable
            className="flex-1 bg-black/50 justify-end"
            onPress={onClose}
         >
            <Pressable
               className="bg-white rounded-t-3xl max-h-[80%]"
               onPress={(e) => e.stopPropagation()}
            >
               {/* Header */}
               <View className="px-6 py-5 border-b border-gray-200 flex-row items-center justify-between">
                  <View>
                     <Text className="text-2xl font-bold text-gray-900">
                        {activeListName}
                     </Text>
                     <Text className="text-sm text-gray-600 mt-1">
                        {totalItems} {totalItems === 1 ? "item" : "items"}
                     </Text>
                  </View>
                  <Pressable onPress={onClose}>
                     <FontAwesome6 name="xmark" size={20} color="#6B7280" />
                  </Pressable>
               </View>

               {/* Cart Items */}
               {cartItems.length === 0 ? (
                  <View className="px-6 py-12 items-center">
                     <FontAwesome6
                        name="list"
                        size={48}
                        color="#D1D5DB"
                     />
                     <Text className="text-lg font-semibold text-gray-600 mt-4">
                        Your list is empty
                     </Text>
                     <Text className="text-sm text-gray-500 mt-2">
                        Add items to get started
                     </Text>
                  </View>
               ) : (
                  <>
                     <ScrollView className="max-h-[400px]">
                        {cartItems.map((item, index) => {
                           const quantity = item.quantity || 1;
                           const itemTotal = item.price * quantity;
                           const unitPriceLabel = `$${item.price.toFixed(2)} each`;

                           return (
                              <View
                                 key={`${item.id}-${index}`}
                                 className={`px-6 py-4 ${index < cartItems.length - 1
                                    ? "border-b border-gray-100"
                                    : ""
                                    }`}
                              >
                                 <View className="flex-row items-start gap-4">
                                    <View className="w-12 h-12 rounded-xl bg-gray-100 items-center justify-center flex-shrink-0 overflow-hidden">
                                       {item.image ? (
                                          <Image
                                             source={{ uri: item.image }}
                                             style={{ width: "100%", height: "100%" }}
                                             resizeMode="cover"
                                          />
                                       ) : (
                                          <FontAwesome6
                                             name="bag-shopping"
                                             size={18}
                                             color="#9CA3AF"
                                          />
                                       )}
                                    </View>

                                    <View className="flex-1 min-w-0">
                                       <Text
                                          className="text-base font-semibold text-gray-900"
                                          numberOfLines={2}
                                       >
                                          {item.name}
                                       </Text>
                                       <View className="flex-row items-center mt-1">
                                          {item.store ? (
                                             <Text className="text-xs text-gray-500">{item.store}</Text>
                                          ) : null}
                                          <Text className="text-xs text-gray-500">
                                             {item.store ? " • " : ""}
                                             {unitPriceLabel}
                                          </Text>
                                       </View>
                                    </View>

                                    <View className="items-end justify-between min-h-[72px]">
                                       <View className="items-end">
                                          <View className="flex-row items-center rounded-lg border border-gray-200 bg-gray-50">
                                             <Pressable
                                                onPress={() => updateQuantity(item.id, quantity - 1)}
                                                className="w-8 h-8 items-center justify-center"
                                             >
                                                <FontAwesome6 name="minus" size={12} color="#4B5563" />
                                             </Pressable>
                                             <View className="min-w-[32px] items-center">
                                                <Text className="text-sm font-semibold text-gray-900">
                                                   {quantity}
                                                </Text>
                                             </View>
                                             <Pressable
                                                onPress={() => updateQuantity(item.id, quantity + 1)}
                                                className="w-8 h-8 items-center justify-center"
                                             >
                                                <FontAwesome6 name="plus" size={12} color="#4B5563" />
                                             </Pressable>
                                          </View>
                                       </View>

                                       <Text className="text-base font-bold text-gray-900">
                                          ${itemTotal.toFixed(2)}
                                       </Text>
                                    </View>
                                 </View>
                              </View>
                           );
                        })}
                     </ScrollView>

                     {/* Total Summary */}
                     <View className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <View className="flex-row items-center justify-between mb-3">
                           <Text className="text-lg font-semibold text-gray-900">
                              Total
                           </Text>
                           <Text className="text-2xl font-bold text-primary_green">
                              ${totalPrice.toFixed(2)}
                           </Text>
                        </View>
                        <Text className="text-sm text-primary_green font-semibold">
                           $12.40 saved
                        </Text>
                     </View>

                     {/* CTA Button */}
                     <View className="px-6 py-4 border-t border-gray-200">
                        <Pressable
                           className="w-full bg-primary_green rounded-xl py-4 items-center shadow-sm"
                           onPress={handleGoToCompare}
                        >
                           <Text className="text-white text-lg font-semibold">
                              View List
                           </Text>
                        </Pressable>
                     </View>
                  </>
               )}
            </Pressable>
         </Pressable>
      </Modal>
   );
}
