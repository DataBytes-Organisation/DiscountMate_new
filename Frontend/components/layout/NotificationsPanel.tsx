import React from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNotificationCenter } from "../../context/NotificationCenterContext";

type Props = {
   visible: boolean;
   onClose: () => void;
};

function formatRelativeDate(value: string) {
   const date = new Date(value);
   if (Number.isNaN(date.getTime())) {
      return "";
   }

   return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
   });
}

export default function NotificationsPanel({ visible, onClose }: Props) {
   const router = useRouter();
   const { width } = useWindowDimensions();
   const compact = width < 980;
   const {
      notifications,
      unreadCount,
      loading,
      panelError,
      markNotificationAsRead,
      markAllNotificationsAsRead,
   } = useNotificationCenter();

   const handleViewSettings = () => {
      onClose();
      router.push("/(tabs)/notifications");
   };

   const handleNotificationPress = async (id: string, ctaRoute?: string) => {
      await markNotificationAsRead(id);
      if (ctaRoute) {
         onClose();
         router.push(ctaRoute as any);
      }
   };

   return (
      <Modal
         visible={visible}
         transparent
         animationType="fade"
         onRequestClose={onClose}
      >
         <Pressable
            onPress={onClose}
            className="flex-1 bg-black/20"
         >
            <Pressable
               onPress={(event) => event.stopPropagation()}
               className={`bg-white border border-gray-100 shadow-2xl ${
                  compact
                     ? "rounded-t-[28px] px-5 pt-5 pb-6 mt-auto"
                     : "rounded-[28px] px-5 py-5 absolute right-6 top-20 w-[380px]"
               }`}
            >
               <View className="flex-row items-center justify-between mb-4">
                  <View>
                     <Text className="text-xl font-bold text-gray-900">
                        Notifications
                     </Text>
                     <Text className="text-sm text-gray-500 mt-1">
                        {unreadCount} unread
                     </Text>
                  </View>
                  <Pressable
                     onPress={onClose}
                     className="w-10 h-10 rounded-full bg-[#F7F8F4] items-center justify-center"
                  >
                     <Ionicons name="close" size={18} color="#6B7280" />
                  </Pressable>
               </View>

               <View className="flex-row items-center justify-between mb-4">
                  <Pressable onPress={markAllNotificationsAsRead}>
                     <Text className="text-sm font-semibold text-primary_green">
                        Mark all as read
                     </Text>
                  </Pressable>
                  <Pressable onPress={handleViewSettings}>
                     <Text className="text-sm font-semibold text-primary_green">
                        Notification settings
                     </Text>
                  </Pressable>
               </View>

               {panelError && (
                  <View className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                     <Text className="text-sm text-red-700">{panelError}</Text>
                  </View>
               )}

               {loading ? (
                  <View className="py-10 items-center">
                     <Text className="text-sm text-gray-500">Loading notifications...</Text>
                  </View>
               ) : notifications.length > 0 ? (
                  <ScrollView
                     className={compact ? "max-h-[60vh]" : "max-h-[440px]"}
                     showsVerticalScrollIndicator={false}
                  >
                     <View className="gap-3">
                        {notifications.map((notification) => (
                           <Pressable
                              key={notification.id}
                              onPress={() =>
                                 handleNotificationPress(notification.id, notification.ctaRoute)
                              }
                              className={`rounded-2xl border px-4 py-4 ${
                                 notification.read
                                    ? "border-gray-100 bg-[#FBFBF9]"
                                    : "border-emerald-100 bg-emerald-50/40"
                              }`}
                           >
                              <View className="flex-row items-start gap-3">
                                 <View
                                    className={`w-10 h-10 rounded-2xl items-center justify-center ${
                                       notification.read ? "bg-white" : "bg-white"
                                    }`}
                                 >
                                    <Ionicons
                                       name="notifications-outline"
                                       size={18}
                                       color={notification.read ? "#6B7280" : "#10B981"}
                                    />
                                 </View>
                                 <View className="flex-1">
                                    <View className="flex-row items-center justify-between gap-3">
                                       <Text
                                          className={`text-sm font-semibold ${
                                             notification.read ? "text-gray-800" : "text-gray-900"
                                          }`}
                                       >
                                          {notification.title}
                                       </Text>
                                       <Text className="text-xs text-gray-400">
                                          {formatRelativeDate(notification.createdAt)}
                                       </Text>
                                    </View>
                                    <Text className="mt-1 text-sm leading-5 text-gray-500">
                                       {notification.message}
                                    </Text>
                                    {!notification.read && (
                                       <Text className="mt-3 text-xs font-semibold text-primary_green">
                                          Tap to mark as read
                                       </Text>
                                    )}
                                 </View>
                              </View>
                           </Pressable>
                        ))}
                     </View>
                  </ScrollView>
               ) : (
                  <View className="py-10 items-center">
                     <Ionicons name="notifications-off-outline" size={28} color="#9CA3AF" />
                     <Text className="mt-4 text-base font-semibold text-gray-700">
                        No notifications yet
                     </Text>
                     <Text className="mt-2 text-sm text-gray-500 text-center leading-6">
                        New in-app alerts will appear here as they become available.
                     </Text>
                  </View>
               )}
            </Pressable>
         </Pressable>
      </Modal>
   );
}
