import React from "react";
import {
   View,
   Text,
   Pressable,
   Image,
   ActivityIndicator,
   ScrollView,
   useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useUserProfile } from "../../context/UserProfileContext";

type HubSectionKey =
   | "dashboard"
   | "notifications"
   | "dietary"
   | "alerts"
   | "profile"
   | "subscription"
   | "expiry"
   | "nearby"
   | "support"
   | "privacy";

type Props = {
   activeKey: HubSectionKey;
   displayName: string;
   email?: string;
   membershipLabel?: string;
   profileImage?: string | null;
   onAvatarPress?: () => void;
   avatarUploading?: boolean;
};

const NAV_ITEMS: Array<{
   key: HubSectionKey;
   label: string;
   icon: string;
   route?: string;
}> = [
   { key: "dashboard", label: "Dashboard", icon: "chart-column", route: "/(tabs)/dashboard" },
   { key: "notifications", label: "Notifications", icon: "bell" },
   { key: "dietary", label: "Dietary Settings", icon: "bowl-food" },
   { key: "alerts", label: "Manage Alert Segments", icon: "tags" },
   { key: "profile", label: "Profile Management", icon: "pen-to-square", route: "/(tabs)/profile" },
   { key: "subscription", label: "Subscription", icon: "star" },
   { key: "expiry", label: "Expiry Tracker", icon: "calendar-day" },
   { key: "nearby", label: "Location & Nearby", icon: "location-dot" },
   { key: "support", label: "Support", icon: "headset", route: "/(tabs)/contact" },
   { key: "privacy", label: "Privacy & Terms", icon: "shield-halved" },
];

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

export default function UserHubSidebar({
   activeKey,
   displayName,
   email,
   membershipLabel,
   profileImage,
   onAvatarPress,
   avatarUploading,
}: Props) {
   const router = useRouter();
   const { width } = useWindowDimensions();
   const { profile } = useUserProfile();
   const resolvedProfileImage = profileImage ?? profile?.profileImage ?? null;
   const compactSidebar = width < 1024;
   const avatarSizeClass = compactSidebar ? "w-20 h-20" : "w-24 h-24";
   const titleAlignClass = compactSidebar ? "text-left" : "text-center";
   const sectionAlignClass = compactSidebar ? "items-start" : "items-center";

   const handleLogout = async () => {
      await AsyncStorage.removeItem("authToken");
      router.push("/login");
   };

   const renderNavItem = (item: (typeof NAV_ITEMS)[number], mobile = false) => {
      const isActive = item.key === activeKey;
      const isEnabled = Boolean(item.route);

      return (
         <Pressable
            key={item.key}
            onPress={item.route ? () => router.push(item.route as any) : undefined}
            className={`flex-row items-center gap-3 ${
               mobile
                  ? `w-[220px] rounded-3xl border px-4 py-4 ${
                       isActive
                          ? "border-emerald-100 bg-emerald-50"
                          : "border-[#ECE7DE] bg-white"
                    }`
                  : `px-4 py-3 border-b border-gray-100 ${
                       isActive
                          ? "bg-emerald-50/80"
                          : isEnabled
                             ? "bg-transparent active:bg-white"
                             : "bg-transparent"
                    }`
            }`}
         >
            <View
               className={`w-10 h-10 rounded-2xl items-center justify-center ${
                  isActive ? "bg-white" : "bg-[#F3F1EC]"
               }`}
            >
               <FontAwesome6
                  name={item.icon}
                  size={16}
                  color={isActive ? "#10B981" : "#6B7280"}
               />
            </View>
            <View className="flex-1">
               <Text
                  className={`text-sm font-semibold ${
                     isActive ? "text-primary_green" : "text-gray-800"
                  }`}
               >
                  {item.label}
               </Text>
               {mobile && (
                  <Text className="mt-1 text-xs text-[#9CA3AF]">
                     {isEnabled ? "Open section" : "Coming soon"}
                  </Text>
               )}
            </View>
            <Ionicons
               name={isEnabled ? "chevron-forward" : "time-outline"}
               size={16}
               color={isActive ? "#10B981" : "#9CA3AF"}
            />
         </Pressable>
      );
   };

   return (
      <View
         className={`w-full bg-[#FCFCFA] border-gray-100 overflow-hidden ${
            compactSidebar ? "border-b" : "border-r"
         }`}
         style={compactSidebar ? undefined : { width: 240 }}
      >
         <View
            className={`px-5 py-6 border-b border-gray-100 ${sectionAlignClass}`}
         >
            <View className="relative mb-4">
               <Pressable
                  onPress={onAvatarPress}
                  disabled={!onAvatarPress || avatarUploading}
                  className={onAvatarPress ? "active:opacity-90" : ""}
               >
                  {resolvedProfileImage ? (
                     <Image
                        source={{ uri: resolvedProfileImage }}
                        className={`${avatarSizeClass} rounded-full border-2 border-emerald-100`}
                     />
                  ) : (
                     <View
                        className={`${avatarSizeClass} rounded-full bg-gradient-to-br from-primary_green to-secondary_green items-center justify-center`}
                     >
                        <Text
                           className={`font-bold text-white ${
                              compactSidebar ? "text-3xl" : "text-4xl"
                           }`}
                        >
                           {getInitials(displayName)}
                        </Text>
                     </View>
                  )}
               </Pressable>

               {onAvatarPress && (
                  <View className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-white border border-emerald-100 items-center justify-center shadow-sm">
                     {avatarUploading ? (
                        <ActivityIndicator color="#10B981" size="small" />
                     ) : (
                        <Ionicons name="camera-outline" size={18} color="#10B981" />
                     )}
                  </View>
               )}
            </View>
            <Text className={`text-xl font-bold text-gray-900 ${titleAlignClass}`}>
               {displayName}
            </Text>
            <Text className={`mt-2 text-sm text-[#9CA3AF] ${titleAlignClass}`}>
               {email || "Signed-in member"}
            </Text>
            <View className="mt-4 px-3 py-1 rounded-full bg-primary_green/10">
               <Text className="text-xs font-semibold text-primary_green">
                  {membershipLabel || "Free Plan"}
               </Text>
            </View>
         </View>

         <View className="px-4 py-4">
            <Text className="text-[11px] font-bold tracking-[0.22em] uppercase text-gray-400 mb-4 px-2">
               Discover
            </Text>
            {compactSidebar ? (
               <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: 12 }}
               >
                  <View className="flex-row gap-3">
                     {NAV_ITEMS.map((item) => renderNavItem(item, true))}
                  </View>
               </ScrollView>
            ) : (
               <View>{NAV_ITEMS.map((item) => renderNavItem(item))}</View>
            )}
         </View>

         <View
            className={`px-4 border-gray-100 ${
               compactSidebar ? "pb-5 pt-0" : "mt-auto py-5 border-t"
            }`}
         >
            <Pressable
               onPress={handleLogout}
               className={`rounded-2xl px-4 py-3 flex-row items-center gap-3 bg-rose-50 ${
                  compactSidebar ? "w-full" : ""
               }`}
            >
               <View className="w-10 h-10 rounded-2xl bg-white items-center justify-center">
                  <Ionicons name="log-out-outline" size={18} color="#F43F5E" />
               </View>
               <Text className="flex-1 text-sm font-semibold text-rose-500">
                  Logout
               </Text>
               <Ionicons name="chevron-forward" size={16} color="#F43F5E" />
            </Pressable>
         </View>
      </View>
   );
}
