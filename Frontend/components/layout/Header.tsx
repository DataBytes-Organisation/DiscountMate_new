import React, { useState } from "react";
import { View, Text, Pressable, Image } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCart } from "../../app/(tabs)/CartContext";
import CartPopover from "./CartPopover";

type HeaderProps = {
   activeRoute?: "Home" | "Compare" | "Specials" | "My Lists" | "Profile" | "Dashboard";
};

type RouteKey = NonNullable<HeaderProps["activeRoute"]>;

const navItems: RouteKey[] = [
   "Home",
   "Compare",
   "Specials",
   "My Lists",
   "Dashboard",
   "Profile",
];

const navRoutes: Record<RouteKey, string> = {
   Home: "/",
   Compare: "/(tabs)/compare",
   Specials: "/specials",
   "My Lists": "/my-lists",
   Dashboard: "/(tabs)/product-dashboard",
   Profile: "/(tabs)/profile",
};

export default function Header({ activeRoute = "Home" }: HeaderProps) {
   const router = useRouter();
   const [showMenu, setShowMenu] = useState(false);
   const [showCartPopover, setShowCartPopover] = useState(false);
   const { getTotalItems } = useCart();
   const cartItemCount = getTotalItems();

   const handleLogout = async () => {
      await AsyncStorage.removeItem("authToken");
      setShowMenu(false);
      router.push("/login");
   };

   const handleProfile = () => {
      setShowMenu(false);
      const profileRoute = navRoutes.Profile ?? "/profile";
      router.push(profileRoute);
   };

   const handleNavPress = (item: RouteKey) => {
      const route = navRoutes[item];
      if (route) {
         router.push(route);
      }
   };

   return (
      <View
         className="w-full flex-row items-center justify-between px-4 md:px-8 py-4 border-b border-gray-100 bg-white"
         style={{ zIndex: 60, elevation: 12 }}
      >
         {/* Left: logo + nav */}
         <View className="flex-row items-center gap-6 md:gap-8">
            {/* Logo + brand */}
            <View className="flex-row items-center gap-2">
               <View className="w-11 h-11 bg-gradient-to-br from-primary_green to-secondary_green rounded-lg flex items-center justify-center shadow-md">
                  <FontAwesome6 name="tag" size={18} color="#FFFFFF" />
               </View>
               <Text className="text-2xl font-bold bg-gradient-to-r from-primary_green to-secondary_green bg-clip-text text-transparent">
                  DiscountMate
               </Text>
            </View>

            {/* Nav */}
            <View className="flex-row items-center gap-1">
               {navItems.map((item) => {
                  const isActive = item === activeRoute;
                  if (isActive) {
                     return (
                        <Pressable
                           key={item}
                           className="px-4 py-2 rounded-lg bg-primary_green/10"
                           onPress={() => handleNavPress(item)}
                        >
                           <Text className="text-[15px] font-semibold text-primary_green">
                              {item}
                           </Text>
                        </Pressable>
                     );
                  }

                  return (
                     <Pressable
                        key={item}
                        className="group px-4 py-2 rounded-lg hover:bg-primary_green/5"
                        onPress={() => handleNavPress(item)}
                     >
                        <Text className="text-[15px] text-gray-600 group-hover:text-primary_green transition-colors">
                           {item}
                        </Text>
                     </Pressable>
                  );
               })}
            </View>
         </View>

         {/* Right: bell + list + avatar */}
         <View className="flex-row items-center gap-3 md:gap-4">
            {/* Notifications */}
            <Pressable className="relative">
               <FontAwesome6
                  name="bell"
                  size={20}
                  className="text-gray-600"
               />
               <View className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
            </Pressable>

            {/* List summary */}
            <Pressable onPress={() => setShowCartPopover(true)}>
               <View className="flex-row items-center gap-3 px-4 md:px-5 py-2.5 bg-gradient-to-r from-primary_green/10 to-secondary_green/10 rounded-xl border border-primary_green/20">
                  <FontAwesome6
                     name="list"
                     size={16}
                     className="text-primary_green"
                  />
                  <Text className="text-sm font-semibold text-[#111827]">
                     {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
                  </Text>
                  <Text className="text-sm font-bold text-primary_green">
                     $12.40 saved
                  </Text>
               </View>
            </Pressable>

            {/* Avatar + menu */}
            <View className="relative">
               <Pressable onPress={() => setShowMenu((prev) => !prev)}>
                  <Image
                     source={{
                        uri: "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg",
                     }}
                     className="w-10 h-10 rounded-full border-2 border-primary_green/30"
                  />
               </Pressable>

               {showMenu && (
                  <View
                     className="absolute right-0 mt-3 w-40 bg-white shadow-xl rounded-xl border border-gray-100 py-2"
                     style={{ top: "70%", zIndex: 70, elevation: 20 }}
                  >
                     <Pressable
                        className="px-4 py-2 hover:bg-gray-50"
                        onPress={handleProfile}
                     >
                        <Text className="text-gray-800">Profile</Text>
                     </Pressable>
                     <Pressable
                        className="px-4 py-2 hover:bg-gray-50"
                        onPress={handleLogout}
                     >
                        <Text className="text-gray-800">Logout</Text>
                     </Pressable>
                  </View>
               )}
            </View>
         </View>

         {/* Cart Popover */}
         <CartPopover
            visible={showCartPopover}
            onClose={() => setShowCartPopover(false)}
         />
      </View>
   );
}
