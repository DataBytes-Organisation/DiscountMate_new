import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
   fetchNotifications,
   markAllNotificationsAsRead as markAllNotificationsAsReadRequest,
   markNotificationAsRead as markNotificationAsReadRequest,
} from "../services/notifications";
import { NotificationItem } from "../types/NotificationItem";

type NotificationCenterContextValue = {
   notifications: NotificationItem[];
   unreadCount: number;
   loading: boolean;
   panelOpen: boolean;
   panelError: string | null;
   openPanel: () => Promise<void>;
   closePanel: () => void;
   refreshNotifications: () => Promise<void>;
   markNotificationAsRead: (id: string) => Promise<void>;
   markAllNotificationsAsRead: () => Promise<void>;
};

const NotificationCenterContext = createContext<NotificationCenterContextValue | undefined>(
   undefined
);

export function NotificationCenterProvider({ children }: { children: ReactNode }) {
   const [notifications, setNotifications] = useState<NotificationItem[]>([]);
   const [unreadCount, setUnreadCount] = useState(0);
   const [loading, setLoading] = useState(false);
   const [panelOpen, setPanelOpen] = useState(false);
   const [panelError, setPanelError] = useState<string | null>(null);

   const refreshNotifications = async () => {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
         setNotifications([]);
         setUnreadCount(0);
         setLoading(false);
         return;
      }

      setLoading(true);
      setPanelError(null);
      try {
         const data = await fetchNotifications();
         setNotifications(data.notifications);
         setUnreadCount(data.unreadCount);
      } catch (error: any) {
         setPanelError(error?.message || "Unable to load notifications.");
      } finally {
         setLoading(false);
      }
   };

   const openPanel = async () => {
      setPanelOpen(true);
      await refreshNotifications();
   };

   const closePanel = () => {
      setPanelOpen(false);
   };

   const markNotificationAsRead = async (id: string) => {
      setPanelError(null);
      try {
         await markNotificationAsReadRequest(id);
         setNotifications((current) =>
            current.map((notification) =>
               notification.id === id ? { ...notification, read: true } : notification
            )
         );
         setUnreadCount((current) => Math.max(0, current - 1));
      } catch (error: any) {
         setPanelError(error?.message || "Unable to update notification.");
      }
   };

   const markAllNotificationsAsRead = async () => {
      setPanelError(null);
      try {
         await markAllNotificationsAsReadRequest();
         setNotifications((current) =>
            current.map((notification) => ({ ...notification, read: true }))
         );
         setUnreadCount(0);
      } catch (error: any) {
         setPanelError(error?.message || "Unable to update notifications.");
      }
   };

   useEffect(() => {
      refreshNotifications();
   }, []);

   return (
      <NotificationCenterContext.Provider
         value={{
            notifications,
            unreadCount,
            loading,
            panelOpen,
            panelError,
            openPanel,
            closePanel,
            refreshNotifications,
            markNotificationAsRead,
            markAllNotificationsAsRead,
         }}
      >
         {children}
      </NotificationCenterContext.Provider>
   );
}

export function useNotificationCenter() {
   const context = useContext(NotificationCenterContext);
   if (!context) {
      throw new Error("useNotificationCenter must be used within a NotificationCenterProvider");
   }

   return context;
}
