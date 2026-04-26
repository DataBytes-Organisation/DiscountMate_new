import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/Api";
import { AlertSegment, AlertSegmentsResponse } from "../types/AlertSegments";
import { normalizeApiErrorMessage } from "../utils/authSession";

async function getAuthToken(): Promise<string> {
   const token = await AsyncStorage.getItem("authToken");
   if (!token) {
      throw new Error("You need to log in to manage alert segments.");
   }

   return token;
}

export async function fetchAlertSegments(): Promise<AlertSegmentsResponse> {
   const token = await getAuthToken();
   const response = await fetch(`${API_URL}/alert-segments`, {
      headers: {
         Authorization: `Bearer ${token}`,
      },
   });

   const data = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(
            data?.message,
            "Unable to load alert segments."
         )
      );
   }

   return data as AlertSegmentsResponse;
}

export async function updateAlertSegment(
   categoryKey: string,
   active: boolean
): Promise<AlertSegment> {
   const token = await getAuthToken();
   const response = await fetch(
      `${API_URL}/alert-segments/${encodeURIComponent(categoryKey)}`,
      {
         method: "PATCH",
         headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
         },
         body: JSON.stringify({ active }),
      }
   );

   const data = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(
            data?.message,
            "Unable to update alert segment."
         )
      );
   }

   return data.segment as AlertSegment;
}
