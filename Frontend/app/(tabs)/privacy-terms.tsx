import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import Ionicons from "react-native-vector-icons/Ionicons";
import UserHubSidebar from "../../components/common/UserHubSidebar";
import { useUserProfile } from "../../context/UserProfileContext";

type DocumentTab = "privacy" | "terms";

type LegalSection = {
   title: string;
   body: string;
};

const LAST_UPDATED = "3 April 2026";

const PRIVACY_SECTIONS: LegalSection[] = [
   {
      title: "Information We Collect",
      body:
         "We collect information you provide directly to us, such as when you create an account, update your profile, set price alerts, or contact us for support. This includes your name, email address, location data when you enable nearby store search, and shopping history within the app.",
   },
   {
      title: "How We Use Your Information",
      body:
         "We use the information we collect to provide, maintain, and improve DiscountMate, including personalised price alerts, deal recommendations, savings summaries, and support responses. We may also use your data to send notifications about price drops or new features you have enabled.",
   },
   {
      title: "Sharing Your Information",
      body:
         "We do not sell your personal data. We may share information with trusted service providers who help us operate the platform, such as cloud infrastructure, analytics, email delivery, and support tools. These providers are required to keep your information confidential and use it only for agreed purposes.",
   },
   {
      title: "Data Retention",
      body:
         "We retain your personal information for as long as your account is active or as needed to provide services. You can request deletion of your account and associated data through the Profile Management or Support sections. Some information may be retained for legal or legitimate business reasons.",
   },
   {
      title: "Your Rights",
      body:
         "Depending on your location, you may have the right to access, correct, delete, or export your personal data. You may also have the right to withdraw consent or object to certain processing. To exercise these rights, contact us through the Support section of the app.",
   },
   {
      title: "Cookies & Tracking",
      body:
         "We use cookies and similar tracking technologies to enhance your experience, remember preferences, and analyse usage patterns. You can control cookie preferences through your browser settings, though some features may be limited if cookies are disabled.",
   },
   {
      title: "Contact Us",
      body:
         "If you have questions about this Privacy Policy, please reach out through the Support page inside the app or email us at supportdiscountmate@gmail.com.",
   },
];

const TERMS_SECTIONS: LegalSection[] = [
   {
      title: "Acceptance of Terms",
      body:
         "By accessing or using DiscountMate, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not use the service. These terms apply to all visitors, users, and others who access or use the platform.",
   },
   {
      title: "Use of the Service",
      body:
         "DiscountMate provides a grocery price comparison and savings tracking platform. You agree to use the service for lawful purposes only and in a manner that does not infringe the rights of others. You must not misuse the platform, attempt to gain unauthorised access, or distribute harmful content.",
   },
   {
      title: "User Accounts",
      body:
         "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorised use. We reserve the right to suspend or terminate accounts that violate these terms.",
   },
   {
      title: "Accuracy of Information",
      body:
         "While we strive to provide accurate and up-to-date pricing information, we cannot guarantee that all prices, product details, or availability are current. Prices are sourced from participating retailers and may vary in-store. Always verify prices before purchasing.",
   },
   {
      title: "Intellectual Property",
      body:
         "All content, logos, features, and functionality of DiscountMate are the property of DiscountMate and are protected by applicable copyright, trademark, and intellectual property laws. You may not reproduce or distribute content without written permission.",
   },
   {
      title: "Limitation of Liability",
      body:
         "To the maximum extent permitted by law, DiscountMate shall not be liable for indirect, incidental, special, or consequential damages arising from your use of the service. Our liability for direct damages is limited to the amount you paid, if any, for the service in the 12 months preceding the claim.",
   },
   {
      title: "Changes to Terms",
      body:
         "We reserve the right to modify these Terms at any time. We will provide notice of significant changes through the app or via email. Your continued use of the service after changes constitutes acceptance of the updated Terms.",
   },
];

function getDisplayName(firstName?: string, lastName?: string) {
   return `${firstName ?? ""} ${lastName ?? ""}`.trim() || "DiscountMate Member";
}

function getMembershipLabel(plan?: string) {
   const normalizedPlan = String(plan || "free");
   return `${normalizedPlan.charAt(0).toUpperCase()}${normalizedPlan.slice(1)} Member`;
}

function LegalAccordionRow({
   section,
   expanded,
   onToggle,
}: {
   section: LegalSection;
   expanded: boolean;
   onToggle: () => void;
}) {
   return (
      <View className="rounded-[24px] border border-gray-100 bg-white shadow-sm overflow-hidden">
         <Pressable
            onPress={onToggle}
            className="px-4 md:px-5 py-4 flex-row items-center justify-between gap-3"
         >
            <View className="flex-row items-center gap-3 flex-1">
               <View className="w-2 h-2 rounded-full bg-primary_green" />
               <Text className="flex-1 text-base font-bold text-gray-900">
                  {section.title}
               </Text>
            </View>
            <Ionicons
               name={expanded ? "chevron-up" : "chevron-down"}
               size={18}
               color="#9CA3AF"
            />
         </Pressable>

         {expanded && (
            <View className="border-t border-gray-100 px-4 md:px-5 py-4">
               <Text className="text-base leading-7 text-gray-600">
                  {section.body}
               </Text>
            </View>
         )}
      </View>
   );
}

export default function PrivacyTermsScreen() {
   const searchParams = useLocalSearchParams<{ tab?: string }>();
   const { profile } = useUserProfile();
   const [activeTab, setActiveTab] = useState<DocumentTab>("privacy");
   const [expandedSectionsByTab, setExpandedSectionsByTab] = useState<
      Record<DocumentTab, string[]>
   >({
      privacy: [PRIVACY_SECTIONS[0].title],
      terms: [TERMS_SECTIONS[0].title],
   });

   const displayName = useMemo(
      () => getDisplayName(profile?.firstName, profile?.lastName),
      [profile?.firstName, profile?.lastName]
   );

   useEffect(() => {
      setActiveTab(searchParams.tab === "terms" ? "terms" : "privacy");
   }, [searchParams.tab]);

   const activeSections = activeTab === "privacy" ? PRIVACY_SECTIONS : TERMS_SECTIONS;
   const pageTitle = activeTab === "privacy" ? "Privacy Policy" : "Terms & Conditions";
   const pageIntro =
      activeTab === "privacy"
         ? "Tap a section to expand its content. Scroll down to read all sections."
         : "These terms govern your use of DiscountMate. Please read all sections carefully.";
   const titleIcon = activeTab === "privacy" ? "shield-halved" : "file-lines";

   const toggleSection = (title: string) => {
      setExpandedSectionsByTab((current) => {
         const activeExpandedSections = current[activeTab];
         const isExpanded = activeExpandedSections.includes(title);

         return {
            ...current,
            [activeTab]: isExpanded
               ? activeExpandedSections.filter((sectionTitle) => sectionTitle !== title)
               : [...activeExpandedSections, title],
         };
      });
   };

   return (
      <View className="flex-1 bg-[#F7F8F4]">
         <View className="flex-col lg:flex-row">
            <UserHubSidebar
               activeKey="privacy"
               displayName={displayName}
               email={profile?.email}
               membershipLabel={getMembershipLabel(profile?.subscriptionPlan)}
               profileImage={profile?.profileImage}
            />

            <View className="flex-1 px-3 md:px-5 xl:px-6 py-4 md:py-5">
               <View className="max-w-[1480px] w-full gap-4">
                  <View className="rounded-[24px] border border-gray-100 bg-white overflow-hidden shadow-sm flex-row">
                     <Pressable
                        onPress={() => setActiveTab("privacy")}
                        className={`flex-1 py-4 px-4 items-center border-b-2 ${
                           activeTab === "privacy"
                              ? "border-primary_green bg-emerald-50/30"
                              : "border-transparent bg-white"
                        }`}
                     >
                        <View className="flex-row items-center gap-2">
                           <FontAwesome6
                              name="shield-halved"
                              size={15}
                              color={activeTab === "privacy" ? "#10B981" : "#9CA3AF"}
                           />
                           <Text
                              className={`text-sm md:text-base font-bold ${
                                 activeTab === "privacy"
                                    ? "text-primary_green"
                                    : "text-gray-500"
                              }`}
                           >
                              Privacy Policy
                           </Text>
                        </View>
                     </Pressable>

                     <Pressable
                        onPress={() => setActiveTab("terms")}
                        className={`flex-1 py-4 px-4 items-center border-b-2 ${
                           activeTab === "terms"
                              ? "border-primary_green bg-emerald-50/30"
                              : "border-transparent bg-white"
                        }`}
                     >
                        <View className="flex-row items-center gap-2">
                           <FontAwesome6
                              name="file-lines"
                              size={15}
                              color={activeTab === "terms" ? "#10B981" : "#9CA3AF"}
                           />
                           <Text
                              className={`text-sm md:text-base font-bold ${
                                 activeTab === "terms"
                                    ? "text-primary_green"
                                    : "text-gray-500"
                              }`}
                           >
                              Terms & Conditions
                           </Text>
                        </View>
                     </Pressable>
                  </View>

                  <View className="px-1 md:px-2 py-2">
                     <View className="flex-row items-center gap-3">
                        <View className="w-10 h-10 rounded-2xl bg-emerald-50 items-center justify-center">
                           <FontAwesome6 name={titleIcon} size={16} color="#10B981" />
                        </View>
                        <View>
                           <Text className="text-xl font-bold text-gray-900">
                              {pageTitle}
                           </Text>
                           <Text className="mt-1 text-sm text-gray-400">
                              Last updated: {LAST_UPDATED}
                           </Text>
                        </View>
                     </View>
                     <Text className="mt-4 text-sm italic text-gray-400">
                        {pageIntro}
                     </Text>
                  </View>

                  <View className="gap-3">
                     {activeSections.map((section) => (
                        <LegalAccordionRow
                           key={section.title}
                           section={section}
                           expanded={expandedSectionsByTab[activeTab].includes(
                              section.title
                           )}
                           onToggle={() => toggleSection(section.title)}
                        />
                     ))}
                  </View>
               </View>
            </View>
         </View>
      </View>
   );
}
