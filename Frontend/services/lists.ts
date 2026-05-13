import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/Api";
import { normalizeApiErrorMessage } from "../utils/authSession";
import { ListPricingSnapshot, SavedListSummary, DashboardRetailerKey } from "../types/SavedList";

type SavedListsResponse = {
   lists?: SavedListSummary[];
   message?: string;
};

type RepriceResponse = {
   snapshot?: ListPricingSnapshot;
   message?: string;
};

async function getAuthToken(): Promise<string> {
   const token = await AsyncStorage.getItem("authToken");
   if (!token) {
      throw new Error("You need to log in to view your saved lists.");
   }

   return token;
}

export async function fetchSavedLists(): Promise<SavedListSummary[]> {
   const token = await getAuthToken();
   const response = await fetch(`${API_URL}/lists`, {
      headers: {
         Authorization: `Bearer ${token}`,
      },
   });

   const data: SavedListsResponse = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(data?.message, "Unable to load saved lists.")
      );
   }

   return Array.isArray(data?.lists) ? data.lists : [];
}

export async function repriceSavedList(
   listId: string,
   selectedRetailer: DashboardRetailerKey
): Promise<ListPricingSnapshot> {
   const token = await getAuthToken();
   const response = await fetch(`${API_URL}/lists/${encodeURIComponent(listId)}/reprice`, {
      method: "POST",
      headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
         selectedRetailer,
      }),
   });

   const data: RepriceResponse = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(data?.message, "Unable to refresh list pricing.")
      );
   }

   if (!data?.snapshot) {
      throw new Error("List pricing snapshot is unavailable.");
   }

   return data.snapshot;
}
