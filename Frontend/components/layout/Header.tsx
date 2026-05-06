import React, { useState } from "react";
import { View, Text, Pressable, Image, useWindowDimensions } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCart } from "../../app/(tabs)/CartContext";
import { useShoppingLists } from "../../app/(tabs)/ShoppingListsContext";
import CartPopover from "./CartPopover";
import { useUserProfile } from "../../context/UserProfileContext";
import { useNotificationCenter } from "../../context/NotificationCenterContext";
import NotificationsPanel from "./NotificationsPanel";

type HeaderProps = {
   activeRoute?:
      | "Home"
      | "Compare"
      | "Specials"
      | "Grocery Lists"
      | "Profile"
      | "Dashboard";
};

type RouteKey = NonNullable<HeaderProps["activeRoute"]>;

const navItems: RouteKey[] = [
   "Home",
   "Compare",
   "Specials",
   "Grocery Lists",
   "Dashboard",
   "Profile",
];

const navRoutes: Record<RouteKey, string> = {
   Home: "/",
   Compare: "/(tabs)/compare",
   Specials: "/specials",
   "Grocery Lists": "/(tabs)/my-lists",
   Dashboard: "/(tabs)/product-dashboard",
   Profile: "/(tabs)/profile",
};

function getInitials(name: string): string {
   const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

   if (parts.length === 0) {
      return "DM";
   }

   return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

export default function Header({ activeRoute = "Home" }: HeaderProps) {
   const router = useRouter();
   const [showMenu, setShowMenu] = useState(false);
   const [showCartPopover, setShowCartPopover] = useState(false);
   const { cartItems, getTotalItems } = useCart();
   const { isLoading } = useShoppingLists();
   const { width } = useWindowDimensions();
   const { profile } = useUserProfile();
   const { unreadCount, panelOpen, openPanel, closePanel } = useNotificationCenter();

   const cartItemCount = getTotalItems();
   const cartTotal = cartItems.reduce(
      (sum, item) => sum + item.price * (item.quantity || 1),
      0
   );
   const compactHeader = width < 980;
   const displayName =
      `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim() ||
      "DiscountMate Member";
   const avatarUri = profile?.profileImage ?? null;

   const handleLogout = async () => {
      await AsyncStorage.removeItem("authToken");
      setShowMenu(false);
      router.push("/login");
   };

   const handleProfile = () => {
      setShowMenu(false);
      router.push(navigationSafe(navRoutes.Profile));
   };

   const handleNavPress = (item: RouteKey) => {
      const route = navRoutes[item];
      if (route) {
         router.push(navigationSafe(route));
      }
   };

   return (
      <View
         className="w-full flex-row items-center justify-between px-4 md:px-8 py-4 border-b border-gray-100 bg-white"
         style={{ zIndex: 60, elevation: 12 }}
      >
         <View className="flex-row items-center gap-4 md:gap-8">
            <View className="flex-row items-center gap-2">
               <View className="w-11 h-11 bg-gradient-to-br from-primary_green to-secondary_green rounded-lg flex items-center justify-center shadow-md">
                  <FontAwesome6 name="tag" size={18} color="#FFFFFF" />
               </View>
               <Text
                  className={`${
                     compactHeader ? "text-xl" : "text-2xl"
                  } font-bold bg-gradient-to-r from-primary_green to-secondary_green bg-clip-text text-transparent`}
               >
                  DiscountMate
               </Text>
            </View>

            {!compactHeader && (
               <View className="flex-row items-center gap-1">
                  {navItems.map((item) => {
                     const isActive = item === activeRoute;
                     return (
                        <Pressable
                           key={item}
                           className={`px-4 py-2 rounded-lg ${
                              isActive
                                 ? "bg-primary_green/10"
                                 : "hover:bg-primary_green/5"
                           }`}
                           onPress={() => handleNavPress(item)}
                        >
                           <Text
                              className={`text-[15px] ${
                                 isActive
                                    ? "font-semibold text-primary_green"
                                    : "text-gray-600"
                              }`}
                           >
                              {item}
                           </Text>
                        </Pressable>
                     );
                  })}
               </View>
            )}
         </View>

         <View className="flex-row items-center gap-2 md:gap-4">
            <Pressable className="relative" onPress={openPanel}>
               <FontAwesome6 name="bell" size={20} className="text-gray-600" />
               {unreadCount > 0 && (
                  <View className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 items-center justify-center">
                     <Text className="text-[10px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                     </Text>
                  </View>
               )}
            </Pressable>

            {isLoading && cartItems.length === 0 ? (
               <View className="flex-row items-center gap-3 px-4 md:px-5 py-2.5 bg-gradient-to-r from-primary_green/10 to-secondary_green/10 rounded-xl border border-primary_green/20">
                  <View className="w-4 h-4 rounded bg-primary_green/25" />
                  <View className="h-4 rounded-full bg-gray-200 w-16" />
                  <View className="h-4 rounded-full bg-gray-200 w-20" />
               </View>
            ) : (
               <Pressable onPress={() => setShowCartPopover(true)}>
                  <View className="flex-row items-center gap-3 px-4 md:px-5 py-2.5 bg-gradient-to-r from-primary_green/10 to-secondary_green/10 rounded-xl border border-primary_green/20">
                     <FontAwesome6
                        name="basket-shopping"
                        size={16}
                        className="text-primary_green"
                     />
                     <Text className="text-sm font-semibold text-[#111827]">
                        {cartItemCount} {cartItemCount === 1 ? "item" : "items"}
                     </Text>
                     {!compactHeader && (
                        <Text className="text-sm font-bold text-gray-900">
                           ${cartTotal.toFixed(2)}
                        </Text>
                     )}
                  </View>
               </Pressable>
            )}

            <View className="relative">
               <Pressable onPress={() => setShowMenu((prev) => !prev)}>
                  {avatarUri ? (
                     <Image
                        source={{ uri: avatarUri }}
                        className="w-10 h-10 rounded-full border-2 border-primary_green/30"
                     />
                  ) : (
                     <View className="w-10 h-10 rounded-full border-2 border-primary_green/30 bg-emerald-50 items-center justify-center">
                        <Text className="text-sm font-bold text-primary_green">
                           {getInitials(displayName)}
                        </Text>
                     </View>
                  )}
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

         <CartPopover
            visible={showCartPopover}
            onClose={() => setShowCartPopover(false)}
         />
         <NotificationsPanel visible={panelOpen} onClose={closePanel} />
      </View>
   );
}

function navigationSafe(route: string) {
   return route as any;
}
