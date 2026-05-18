import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/Api";
import { DashboardRangeKey, DashboardSummary } from "../types/DashboardSummary";
import { DashboardRetailerKey } from "../types/SavedList";
import { normalizeApiErrorMessage } from "../utils/authSession";

type DashboardPreferencesResponse = {
   selected_dashboard_list_id?: string;
   selected_dashboard_retailer?: DashboardRetailerKey;
   message?: string;
};

type DashboardRepriceResponse = {
   snapshotsCreated?: number;
   message?: string;
};

export async function fetchDashboardSummary(
   range: DashboardRangeKey = "1y"
): Promise<DashboardSummary> {
   const token = await AsyncStorage.getItem("authToken");
   if (!token) {
      throw new Error("You need to log in to view your dashboard.");
   }

   const response = await fetch(`${API_URL}/dashboard/summary?range=${encodeURIComponent(range)}`, {
      headers: {
         Authorization: `Bearer ${token}`,
      },
   });

   const data = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(
            data?.message,
            "Unable to load dashboard summary."
         )
      );
   }

   return data as DashboardSummary;
}

export async function fetchDashboardPreferences(): Promise<{
   selectedDashboardListId: string;
   selectedDashboardRetailer: DashboardRetailerKey;
}> {
   const token = await AsyncStorage.getItem("authToken");
   if (!token) {
      throw new Error("You need to log in to view your dashboard.");
   }

   const response = await fetch(`${API_URL}/users/dashboard-preferences`, {
      headers: {
         Authorization: `Bearer ${token}`,
      },
   });

   const data: DashboardPreferencesResponse = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(
            data?.message,
            "Unable to load dashboard preferences."
         )
      );
   }

   return {
      selectedDashboardListId: String(data?.selected_dashboard_list_id || ""),
      selectedDashboardRetailer:
         (data?.selected_dashboard_retailer as DashboardRetailerKey) || "coles",
   };
}

export async function updateDashboardPreferences(payload: {
   selectedDashboardListId: string;
   selectedDashboardRetailer: DashboardRetailerKey;
}): Promise<{
   selectedDashboardListId: string;
   selectedDashboardRetailer: DashboardRetailerKey;
}> {
   const token = await AsyncStorage.getItem("authToken");
   if (!token) {
      throw new Error("You need to log in to update dashboard preferences.");
   }

   const response = await fetch(`${API_URL}/users/dashboard-preferences`, {
      method: "PUT",
      headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
         selected_dashboard_list_id: payload.selectedDashboardListId,
         selected_dashboard_retailer: payload.selectedDashboardRetailer,
      }),
   });

   const data: DashboardPreferencesResponse = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(
            data?.message,
            "Unable to update dashboard preferences."
         )
      );
   }

   return {
      selectedDashboardListId: String(data?.selected_dashboard_list_id || ""),
      selectedDashboardRetailer:
         (data?.selected_dashboard_retailer as DashboardRetailerKey) || "coles",
   };
}

export async function repriceDashboardLists(
   selectedRetailer: DashboardRetailerKey
): Promise<{ snapshotsCreated: number }> {
   const token = await AsyncStorage.getItem("authToken");
   if (!token) {
      throw new Error("You need to log in to refresh dashboard pricing.");
   }

   const response = await fetch(`${API_URL}/dashboard/reprice`, {
      method: "POST",
      headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
         selectedRetailer,
      }),
   });

   const data: DashboardRepriceResponse = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(
            data?.message,
            "Unable to refresh dashboard pricing."
         )
      );
   }

   return {
      snapshotsCreated: Number(data?.snapshotsCreated || 0),
   };
}
