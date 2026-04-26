import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/Api";
import { NotificationItem } from "../types/NotificationItem";
import { NotificationPreferences } from "../types/NotificationPreferences";
import { normalizeApiErrorMessage } from "../utils/authSession";

type NotificationPreferencesResponse = {
   notification_preferences?: {
      alert_types?: {
         price_alerts?: boolean;
         weekly_summary?: boolean;
         in_browser_notifications?: boolean;
      };
   };
};

type NotificationsResponse = {
   notifications?: Array<{
      id?: string;
      title?: string;
      message?: string;
      type?: string;
      read?: boolean;
      created_at?: string;
      cta_route?: string;
   }>;
   unread_count?: number;
};

async function getAuthToken(): Promise<string> {
   const token = await AsyncStorage.getItem("authToken");
   if (!token) {
      throw new Error("You need to log in to view notifications.");
   }

   return token;
}

function mapNotificationPreferences(
   response?: NotificationPreferencesResponse["notification_preferences"]
): NotificationPreferences {
   const alertTypes = response?.alert_types || {};

   return {
      alertTypes: {
         priceAlerts:
            typeof alertTypes.price_alerts === "boolean"
               ? alertTypes.price_alerts
               : true,
         browserNotifications:
            typeof alertTypes.in_browser_notifications === "boolean"
               ? alertTypes.in_browser_notifications
               : true,
         weeklySummary:
            typeof alertTypes.weekly_summary === "boolean"
               ? alertTypes.weekly_summary
               : true,
      },
   };
}

function mapNotificationItem(
   notification: NonNullable<NotificationsResponse["notifications"]>[number]
): NotificationItem {
   return {
      id: String(notification?.id || ""),
      title: String(notification?.title || "Notification"),
      message: String(notification?.message || ""),
      type: String(notification?.type || "general"),
      read: Boolean(notification?.read),
      createdAt:
         typeof notification?.created_at === "string"
            ? notification.created_at
            : new Date().toISOString(),
      ctaRoute:
         typeof notification?.cta_route === "string"
            ? notification.cta_route
            : undefined,
   };
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
   const token = await getAuthToken();
   const response = await fetch(`${API_URL}/users/notification-preferences`, {
      headers: {
         Authorization: `Bearer ${token}`,
      },
   });

   const data: NotificationPreferencesResponse = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(
            (data as any)?.message,
            "Unable to load notification settings."
         )
      );
   }

   return mapNotificationPreferences(data.notification_preferences);
}

export async function saveNotificationPreferences(
   preferences: NotificationPreferences
): Promise<NotificationPreferences> {
   const token = await getAuthToken();
   const response = await fetch(`${API_URL}/users/notification-preferences`, {
      method: "PUT",
      headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
         notification_preferences: {
            alert_types: {
               price_alerts: preferences.alertTypes.priceAlerts,
               in_browser_notifications:
                  preferences.alertTypes.browserNotifications,
               weekly_summary: preferences.alertTypes.weeklySummary,
            },
         },
      }),
   });

   const data: NotificationPreferencesResponse & { message?: string } = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(
            data?.message,
            "Unable to update notification settings."
         )
      );
   }

   return mapNotificationPreferences(data.notification_preferences);
}

export async function fetchNotifications(): Promise<{
   notifications: NotificationItem[];
   unreadCount: number;
}> {
   const token = await getAuthToken();
   const response = await fetch(`${API_URL}/notifications`, {
      headers: {
         Authorization: `Bearer ${token}`,
      },
   });

   const data: NotificationsResponse & { message?: string } = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(
            data?.message,
            "Unable to load notifications."
         )
      );
   }

   const notifications = Array.isArray(data.notifications)
      ? data.notifications.map(mapNotificationItem)
      : [];

   return {
      notifications,
      unreadCount:
         typeof data.unread_count === "number"
            ? data.unread_count
            : notifications.filter((notification) => !notification.read).length,
   };
}

export async function markNotificationAsRead(id: string): Promise<void> {
   const token = await getAuthToken();
   const response = await fetch(`${API_URL}/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
      headers: {
         Authorization: `Bearer ${token}`,
      },
   });

   const data = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(
            data?.message,
            "Unable to update notification."
         )
      );
   }
}

export async function markAllNotificationsAsRead(): Promise<void> {
   const token = await getAuthToken();
   const response = await fetch(`${API_URL}/notifications/read-all`, {
      method: "PATCH",
      headers: {
         Authorization: `Bearer ${token}`,
      },
   });

   const data = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(
            data?.message,
            "Unable to update notifications."
         )
      );
   }
}
