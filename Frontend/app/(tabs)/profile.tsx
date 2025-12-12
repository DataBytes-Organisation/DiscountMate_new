// app/(tabs)/profile.tsx
import React from "react";
import { View } from "react-native";

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

export default function ProfilePage() {
   // later: get user data from context / query
   // const { user } = useUser();

   return (
      <>
         <View className="bg-[#F3F4F6]">
            {/* Top profile header - spans full width */}
            <ProfileHeaderCard />

            <View className="px-4 pt-4 pb-10">
               {/* Main content + sidebar */}
               <View className="flex-row gap-4 mt-4">
                  {/* LEFT COLUMN */}
                  <View className="flex-1">
                     <ProfileBasicInfoSection />
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
         </View>
         {/* Footer - outside padded container to span full width */}
         <View style={{ marginHorizontal: -16 }}>
            <FooterSection disableEdgeOffset />
         </View>
      </>
   );
}
