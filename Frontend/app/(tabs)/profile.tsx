// app/(tabs)/profile.tsx
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import ProfileHeaderCard from "../../components/profile/ProfileHeaderCard";
import ProfileBasicInfoSection from "../../components/profile/ProfileBasicInfoSection";
import ProfileShoppingListsSection from "../../components/profile/ProfileShoppingListsSection";
import ProfilePriceAlertsSection from "../../components/profile/ProfilePriceAlertsSection";
import ProfilePreferredStoresSection from "../../components/profile/ProfilePreferredStoresSection";
import ProfileNotificationPreferencesSection from "../../components/profile/ProfileNotificationPreferencesSection";
import ProfileDietaryPreferencesSection from "../../components/profile/ProfileDietaryPreferencesSection";
import ProfileShoppingHistorySection from "../../components/profile/ProfileShoppingHistorySection";

import ProfileSavingsOverviewCard from "../../components/profile/ProfileSavingsOverviewCard";
import ProfileRecentActivityCard from "../../components/profile/ProfileRecentActivityCard";
import ProfileAchievementsCard from "../../components/profile/ProfileAchievementsCard";
import ProfileAccountActionsCard from "../../components/profile/ProfileAccountActionsCard";
import ProfileHelpCard from "../../components/profile/ProfileHelpCard";
import FooterSection from "../../components/home/FooterSection";
import { API_URL } from "../../constants/Api";
import { UserProfile } from "../../types/UserProfile";

const ProfileHeader = ProfileHeaderCard as React.ComponentType<{
   user?: UserProfile | null;
   loading?: boolean;
}>;

const ProfileBasicInfo = ProfileBasicInfoSection as React.ComponentType<{
   user?: UserProfile | null;
   loading?: boolean;
}>;

export default function ProfilePage() {
   const [user, setUser] = useState<UserProfile | null>(null);
   const [loading, setLoading] = useState<boolean>(true);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      let isMounted = true;

      const fetchProfile = async () => {
         setLoading(true);
         setError(null);
         try {
            const token = await AsyncStorage.getItem("authToken");
            if (!token) {
               throw new Error("You need to log in to view your profile.");
            }

            const response = await fetch(`${API_URL}/users/profile`, {
               headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();
            if (!response.ok) {
               const message =
                  typeof data === "string"
                     ? data
                     : data?.message || "Unable to load profile";
               throw new Error(message);
            }

            const profile: UserProfile = {
               firstName: data.user_fname ?? "",
               lastName: data.user_lname ?? "",
               email: data.email ?? "",
               phoneNumber: data.phone_number ?? "",
               phoneVerified: Boolean(data.phone_number),
               address: data.address ?? "",
               postcode: data.address ?? "",
               memberSince: data.memberSince,
               profileImage:
                  data?.profile_image?.content &&
                     typeof data.profile_image.content === "string"
                     ? `data:${data.profile_image.mime};base64,${data.profile_image.content}`
                     : null,
               totalSaved: data.totalSaved ?? 0,
               shoppingTrips: data.shoppingTrips ?? 0,
               activeAlerts: data.activeAlerts ?? 0,
               shoppingLists: data.shoppingLists ?? 0,
            };

            if (isMounted) {
               setUser(profile);
            }
         } catch (err: any) {
            if (isMounted) {
               setError(err.message || "Something went wrong.");
            }
         } finally {
            if (isMounted) {
               setLoading(false);
            }
         }
      };

      fetchProfile();

      return () => {
         isMounted = false;
      };
   }, []);

   return (
      <>
         <View className="bg-[#F3F4F6]">
            {/* Top profile header - spans full width */}
            <ProfileHeader user={user} loading={loading} />

            <View className="px-4 pt-4 pb-10">
               {/* Main content + sidebar */}
               <View className="flex-row gap-4 mt-4">
                  {/* LEFT COLUMN */}
                  <View className="flex-1">
                     <ProfileBasicInfo user={user} loading={loading} />
                     <ProfileShoppingListsSection />
                     <ProfilePriceAlertsSection />
                     <ProfilePreferredStoresSection />
                     <ProfileNotificationPreferencesSection />
                     <ProfileDietaryPreferencesSection />
                     <ProfileShoppingHistorySection />
                  </View>

                  {/* RIGHT SIDEBAR */}
                  <View className="w-[280px]">
                     <ProfileSavingsOverviewCard />
                     <ProfileRecentActivityCard />
                     <ProfileAchievementsCard />
                     <ProfileAccountActionsCard />
                     <ProfileHelpCard />
                  </View>
               </View>
            </View>

            {error && (
               <View className="px-4 pb-4">
                  <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                     <Text className="text-red-700 text-sm">{error}</Text>
                  </View>
               </View>
            )}

            {loading && (
               <View className="px-4 pb-4">
                  <View className="flex-row items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                     <ActivityIndicator color="#10B981" />
                     <Text className="text-gray-700">Loading your profile...</Text>
                  </View>
               </View>
            )}
         </View>
         {/* Footer - outside padded container to span full width */}
         <View style={{ marginHorizontal: -16 }}>
            <FooterSection disableEdgeOffset />
         </View>
      </>
   );
}
