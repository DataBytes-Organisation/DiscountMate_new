import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import UserHubSidebar from "../../components/common/UserHubSidebar";
import ProfileBasicInfoSection from "../../components/profile/ProfileBasicInfoSection";
import ProfilePasswordSection from "../../components/profile/ProfilePasswordSection";
import ProfileDeleteAccountSection from "../../components/profile/ProfileDeleteAccountSection";
import {
   changePassword,
   deleteAccount,
   fetchProfile,
   saveProfile,
   uploadProfileImage,
} from "../../services/profile";
import { useUserProfile } from "../../context/UserProfileContext";
import { UserProfile } from "../../types/UserProfile";
import { SESSION_EXPIRED_MESSAGE } from "../../utils/authSession";

const FALLBACK_USER: UserProfile = {
   firstName: "",
   lastName: "",
   email: "",
   phoneNumber: "",
   address: "",
   postcode: "",
   memberSince: "",
   subscriptionPlan: "free",
   totalSaved: 0,
   shoppingTrips: 0,
   activeAlerts: 0,
   shoppingLists: 0,
   profileImage: null,
};

function getDisplayName(user: UserProfile) {
   return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "DiscountMate Member";
}

export default function ProfileScreen() {
   const router = useRouter();
   const { setCachedProfile } = useUserProfile();
   const [user, setUser] = useState<UserProfile>(FALLBACK_USER);
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [uploadingImage, setUploadingImage] = useState(false);
   const [changingPassword, setChangingPassword] = useState(false);
   const [deletingAccount, setDeletingAccount] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [successMessage, setSuccessMessage] = useState<string | null>(null);

   useEffect(() => {
      let active = true;

      const loadProfile = async () => {
         setLoading(true);
         setError(null);
         try {
            const data = await fetchProfile();
            if (active) {
               setUser(data);
               setCachedProfile(data);
            }
         } catch (err: any) {
            if (active) {
               const message = err?.message || "Unable to load your profile.";
               if (message === SESSION_EXPIRED_MESSAGE) {
                  setError(message);
                  router.replace("/login");
                  return;
               }

               setError(message);
            }
         } finally {
            if (active) {
               setLoading(false);
            }
         }
      };

      loadProfile();

      return () => {
         active = false;
      };
   }, []);

   const displayName = useMemo(() => getDisplayName(user), [user]);
   const membershipLabel = useMemo(() => {
      const plan = String(user.subscriptionPlan || "free");
      return `${plan.charAt(0).toUpperCase()}${plan.slice(1)} Member`;
   }, [user.subscriptionPlan]);

   const handleSave = async (nextProfile: UserProfile) => {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      try {
         const updated = await saveProfile(nextProfile);
         const mergedUser = {
            ...user,
            ...updated,
         };
         setUser(mergedUser);
         setCachedProfile(mergedUser);
         setSuccessMessage("Profile updated successfully.");
      } catch (err: any) {
         const message = err?.message || "Unable to save your profile.";
         setError(message);
         if (message === SESSION_EXPIRED_MESSAGE) {
            router.replace("/login");
         }
         throw err;
      } finally {
         setSaving(false);
      }
   };

   const handleAvatarUpload = async () => {
      setError(null);
      setSuccessMessage(null);

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
         setError("Please allow photo library access to upload your profile picture.");
         return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
         mediaTypes: ImagePicker.MediaTypeOptions.Images,
         allowsEditing: true,
         aspect: [1, 1],
         quality: 0.8,
      });

      if (result.canceled || result.assets.length === 0) {
         return;
      }

      const asset = result.assets[0];
      setUploadingImage(true);

      try {
         const nextProfileImage = await uploadProfileImage({
            uri: asset.uri,
            fileName: asset.fileName ?? `profile-${Date.now()}.jpg`,
            mimeType: asset.mimeType ?? "image/jpeg",
            file: (asset as any).file,
         });

         const nextUser = {
            ...user,
            profileImage: nextProfileImage,
         };

         setUser(nextUser);
         setCachedProfile(nextUser);
         setSuccessMessage("Profile picture updated successfully.");
      } catch (err: any) {
         const message =
            err?.message || "Unable to upload your profile picture.";
         setError(message);
         if (message === SESSION_EXPIRED_MESSAGE) {
            router.replace("/login");
         }
      } finally {
         setUploadingImage(false);
      }
   };

   const handlePasswordChange = async (payload: {
      currentPassword: string;
      newPassword: string;
      confirmNewPassword: string;
   }) => {
      setChangingPassword(true);
      setError(null);
      setSuccessMessage(null);

      try {
         const message = await changePassword(payload);
         setSuccessMessage(message);
      } catch (err: any) {
         const message = err?.message || "Unable to update your password.";
         setError(message);
         if (message === SESSION_EXPIRED_MESSAGE) {
            router.replace("/login");
         }
         throw err;
      } finally {
         setChangingPassword(false);
      }
   };

   const handleDeleteAccount = async () => {
      setDeletingAccount(true);
      setError(null);
      setSuccessMessage(null);

      try {
         await deleteAccount();
         await AsyncStorage.removeItem("authToken");
         setCachedProfile(null);
         router.replace("/login");
      } catch (err: any) {
         const message = err?.message || "Unable to delete your account.";
         setError(message);
         if (message === SESSION_EXPIRED_MESSAGE) {
            router.replace("/login");
         }
         throw err;
      } finally {
         setDeletingAccount(false);
      }
   };

   return (
      <View className="flex-1 bg-[#F7F8F4]">
         <View className="flex-col lg:flex-row">
            <UserHubSidebar
               activeKey="profile"
               displayName={displayName}
               email={user.email}
               membershipLabel={membershipLabel}
               profileImage={user.profileImage}
               onAvatarPress={handleAvatarUpload}
               avatarUploading={uploadingImage}
            />

            <View className="flex-1 px-3 md:px-5 xl:px-6 py-4 md:py-5">
               {error && (
                  <View className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                     <Text className="text-sm text-red-700">{error}</Text>
                  </View>
               )}

               {successMessage && (
                  <View className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                     <Text className="text-sm text-emerald-700">{successMessage}</Text>
                  </View>
               )}

               {loading ? (
                  <View className="rounded-3xl border border-gray-100 bg-white px-5 py-8 flex-row items-center gap-3">
                     <ActivityIndicator color="#10B981" />
                     <Text className="text-gray-700">Loading your profile settings...</Text>
                  </View>
               ) : (
                  <View className="max-w-[1480px] w-full gap-4">
                     <ProfileBasicInfoSection
                        user={user}
                        loading={loading}
                        saving={saving}
                        membershipLabel={membershipLabel}
                        profileImage={user.profileImage}
                        onAvatarPress={handleAvatarUpload}
                        avatarUploading={uploadingImage}
                        onSave={handleSave}
                     />

                     <ProfilePasswordSection
                        saving={changingPassword}
                        onSubmit={handlePasswordChange}
                     />

                     <ProfileDeleteAccountSection
                        deleting={deletingAccount}
                        onDelete={handleDeleteAccount}
                     />
                  </View>
               )}
            </View>
         </View>
      </View>
   );
}
