import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { API_URL } from "../constants/Api";
import { UserProfile } from "../types/UserProfile";
import { normalizeApiErrorMessage } from "../utils/authSession";

type ProfileResponse = {
   user_fname?: string;
   user_lname?: string;
   email?: string;
   address?: string;
   phone_number?: string;
   postcode?: string;
   member_since?: string;
   subscription_plan?: string;
   total_saved?: number;
   shopping_trips?: number;
   active_alerts?: number;
   shopping_lists?: number;
   profile_image?: string | null;
   email_verified?: boolean;
   phone_verified?: boolean;
};

export type AddressSuggestion = {
   label: string;
   address: string;
   postcode?: string;
   state?: string;
   suburb?: string;
   latitude?: string;
   longitude?: string;
};

export type ProfileImageUploadInput = {
   uri: string;
   fileName?: string | null;
   mimeType?: string | null;
   file?: any;
};

export type ChangePasswordInput = {
   currentPassword: string;
   newPassword: string;
   confirmNewPassword: string;
};

type AddressSuggestionResponse = {
   suggestions?: AddressSuggestion[];
};

function mapProfile(response: ProfileResponse): UserProfile {
   return {
      firstName: response.user_fname ?? "",
      lastName: response.user_lname ?? "",
      email: response.email ?? "",
      emailVerified:
         typeof response.email_verified === "boolean"
            ? response.email_verified
            : Boolean(response.email),
      address: response.address ?? "",
      phoneNumber: response.phone_number ?? "",
      postcode: response.postcode ?? "",
      memberSince: response.member_since ?? "",
      subscriptionPlan: response.subscription_plan ?? "free",
      totalSaved: Number(response.total_saved || 0),
      shoppingTrips: Number(response.shopping_trips || 0),
      activeAlerts: Number(response.active_alerts || 0),
      shoppingLists: Number(response.shopping_lists || 0),
      profileImage: response.profile_image ?? null,
      phoneVerified:
         typeof response.phone_verified === "boolean"
            ? response.phone_verified
            : Boolean(response.phone_number),
   };
}

async function getAuthToken(): Promise<string> {
   const token = await AsyncStorage.getItem("authToken");
   if (!token) {
      throw new Error("You need to log in to view your profile.");
   }

   return token;
}

export async function fetchProfile(): Promise<UserProfile> {
   const token = await getAuthToken();
   const response = await fetch(`${API_URL}/users/profile`, {
      headers: {
         Authorization: `Bearer ${token}`,
      },
   });

   const data = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(data?.message, "Unable to load profile.")
      );
   }

   return mapProfile(data);
}

export async function saveProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
   const token = await getAuthToken();
   const response = await fetch(`${API_URL}/users/profile`, {
      method: "PUT",
      headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
         firstName: profile.firstName ?? "",
         lastName: profile.lastName ?? "",
         phoneNumber: profile.phoneNumber ?? "",
         address: profile.address ?? "",
         postcode: profile.postcode ?? "",
      }),
   });

   const data = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(data?.message, "Unable to update profile.")
      );
   }

   return mapProfile(data?.profile || {});
}

export async function uploadProfileImage(
   image: ProfileImageUploadInput
): Promise<string | null> {
   const token = await getAuthToken();
   const formData = new FormData();
   const fileName = image.fileName ?? `profile-${Date.now()}.jpg`;
   const mimeType = image.mimeType ?? "image/jpeg";

   if (Platform.OS === "web") {
      if (image.file instanceof Blob) {
         formData.append("image", image.file, fileName);
      } else {
         const response = await fetch(image.uri);
         const blob = await response.blob();
         formData.append("image", blob, fileName);
      }
   } else {
      formData.append(
         "image",
         {
            uri: image.uri,
            name: fileName,
            type: mimeType,
         } as any
      );
   }

   const response = await fetch(`${API_URL}/users/upload-profile-image`, {
      method: "POST",
      headers: {
         Authorization: `Bearer ${token}`,
      },
      body: formData,
   });

   const data = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(
            data?.message,
            "Unable to update profile image."
         )
      );
   }

   return data?.profile_image ?? null;
}

export async function changePassword(
   payload: ChangePasswordInput
): Promise<string> {
   const token = await getAuthToken();
   const response = await fetch(`${API_URL}/users/change-password`, {
      method: "PUT",
      headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
   });

   const data = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(data?.message, "Unable to update password.")
      );
   }

   return data?.message || "Password updated successfully";
}

export async function deleteAccount(): Promise<string> {
   const token = await getAuthToken();
   const response = await fetch(`${API_URL}/users/account`, {
      method: "DELETE",
      headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ confirmDelete: true }),
   });

   const data = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(data?.message, "Unable to delete account.")
      );
   }

   return data?.message || "Account deleted successfully";
}

export async function fetchAustralianAddressSuggestions(
   query: string
): Promise<AddressSuggestion[]> {
   const trimmedQuery = String(query || "").trim();
   if (trimmedQuery.length < 3) {
      return [];
   }

   const token = await getAuthToken();
   const response = await fetch(
      `${API_URL}/users/address-suggestions?q=${encodeURIComponent(trimmedQuery)}`,
      {
         headers: {
            Authorization: `Bearer ${token}`,
         },
      }
   );

   const data: AddressSuggestionResponse = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(
            (data as any)?.message,
            "Unable to load Australian address suggestions."
         )
      );
   }

   return Array.isArray(data?.suggestions) ? data.suggestions : [];
}
