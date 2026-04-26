import React, { useEffect, useMemo, useState } from "react";
import {
   ActivityIndicator,
   Platform,
   Pressable,
   Text,
   TextInput,
   View,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "react-native-vector-icons/Ionicons";
import UserHubSidebar from "../../components/common/UserHubSidebar";
import { useUserProfile } from "../../context/UserProfileContext";
import { submitSupportRequest } from "../../services/support";
import {
   SupportFaqItem,
   SupportFormState,
   SupportRequestResponse,
} from "../../types/Support";

const SUPPORT_EMAIL = "supportdiscountmate@gmail.com";
const RESPONSE_TIME = "24-48 hours";

const FAQ_ITEMS: SupportFaqItem[] = [
   {
      id: "price-alerts",
      question: "How do price alerts work?",
      answer:
         "Turn on in-app notifications and manage your alert segments to hear about discounted products and specials that match the categories you care about.",
   },
   {
      id: "category-alerts",
      question: "How do category alerts work?",
      answer:
         "Category alerts watch the categories you enable in Manage Alert Segments. When supported deal data finds discounted or on-special products in those groups, DiscountMate can surface them in your notification bell.",
   },
   {
      id: "subscription-plan",
      question: "How do I change my subscription plan?",
      answer:
         "Open the Subscription page from your profile hub, choose a plan, and save it. The current version updates your selected plan in-app without running real billing yet.",
   },
   {
      id: "price-differences",
      question: "Why do prices sometimes differ from what I see in store?",
      answer:
         "Retail prices can change during the day or vary by store. DiscountMate aims to keep pricing current, but we still recommend confirming the final price at checkout.",
   },
   {
      id: "contact-support",
      question: "How do I contact DiscountMate support?",
      answer:
         "Use the email support form on this page. Our team reviews incoming requests and replies by email.",
   },
];

const SUPPORT_TOPICS = [
   "Account",
   "Billing",
   "Alerts",
   "Deals",
   "Bug report",
   "Other",
] as const;

const INITIAL_FORM: SupportFormState = {
   name: "",
   email: "",
   topic: "Other",
   subject: "",
   message: "",
   attachment: null,
};

function getDisplayName(firstName?: string, lastName?: string) {
   return `${firstName ?? ""} ${lastName ?? ""}`.trim() || "DiscountMate Member";
}

function formatAttachmentSize(size: number) {
   if (size < 1024 * 1024) {
      return `${Math.max(1, Math.round(size / 1024))} KB`;
   }

   return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SupportScreen() {
   const router = useRouter();
   const { profile } = useUserProfile();
   const [searchTerm, setSearchTerm] = useState("");
   const [form, setForm] = useState<SupportFormState>(INITIAL_FORM);
   const [submitting, setSubmitting] = useState(false);
   const [expandedFaqId, setExpandedFaqId] = useState<string | null>(FAQ_ITEMS[0].id);
   const [error, setError] = useState<string | null>(null);
   const [submissionResult, setSubmissionResult] =
      useState<SupportRequestResponse | null>(null);

   useEffect(() => {
      setForm((current) => ({
         ...current,
         name:
            current.name ||
            `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim(),
         email: current.email || profile?.email || "",
      }));
   }, [profile?.firstName, profile?.lastName, profile?.email]);

   const displayName = useMemo(
      () => getDisplayName(profile?.firstName, profile?.lastName),
      [profile?.firstName, profile?.lastName]
   );

   const membershipLabel = useMemo(() => {
      const plan = String(profile?.subscriptionPlan || "free");
      return `${plan.charAt(0).toUpperCase()}${plan.slice(1)} Member`;
   }, [profile?.subscriptionPlan]);

   const filteredFaqs = useMemo(() => {
      const normalizedTerm = searchTerm.trim().toLowerCase();

      if (!normalizedTerm) {
         return FAQ_ITEMS;
      }

      return FAQ_ITEMS.filter((item) =>
         `${item.question} ${item.answer}`.toLowerCase().includes(normalizedTerm)
      );
   }, [searchTerm]);

   useEffect(() => {
      if (!filteredFaqs.length) {
         setExpandedFaqId(null);
         return;
      }

      const stillVisible = filteredFaqs.some((item) => item.id === expandedFaqId);
      if (!stillVisible) {
         setExpandedFaqId(filteredFaqs[0].id);
      }
   }, [filteredFaqs, expandedFaqId]);

   const updateField = (key: keyof SupportFormState, value: string) => {
      setForm((current) => ({
         ...current,
         [key]: value,
      }));
   };

   const handleChooseAttachment = () => {
      if (Platform.OS !== "web") {
         setError("File attachments are available in the web app.");
         return;
      }

      const input = globalThis.document?.getElementById(
         "support-attachment-input"
      ) as HTMLInputElement | null;

      if (!input) {
         setError("File attachments are available in the web app.");
         return;
      }

      input.click();
   };

   const handleAttachmentChange = (event: any) => {
      const file = event?.target?.files?.[0];

      if (!file) {
         return;
      }

      if (file.size > 10 * 1024 * 1024) {
         setError("Please choose a PNG, JPG, or PDF file under 10 MB.");
         event.target.value = "";
         return;
      }

      const allowedTypes = ["image/png", "image/jpeg", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
         setError("Only PNG, JPG, and PDF files are supported.");
         event.target.value = "";
         return;
      }

      setError(null);
      setForm((current) => ({
         ...current,
         attachment: {
            name: file.name,
            size: file.size,
            type: file.type,
            file,
         },
      }));
   };

   const clearAttachment = () => {
      const input = globalThis.document?.getElementById(
         "support-attachment-input"
      ) as HTMLInputElement | null;

      if (input) {
         input.value = "";
      }

      setForm((current) => ({
         ...current,
         attachment: null,
      }));
   };

   const validateBeforeSubmit = () => {
      const trimmedName = form.name.trim();
      const trimmedEmail = form.email.trim();
      const trimmedSubject = form.subject.trim();
      const trimmedMessage = form.message.trim();
      const trimmedTopic = form.topic.trim();

      if (!trimmedName || !trimmedEmail || !trimmedSubject || !trimmedMessage || !trimmedTopic) {
         setError("Please complete topic, subject, name, email, and message before sending.");
         return null;
      }

      return {
         name: trimmedName,
         email: trimmedEmail,
         topic: trimmedTopic,
         subject: trimmedSubject,
         message: trimmedMessage,
         attachment: form.attachment,
      };
   };

   const handleSubmit = async () => {
      const payload = validateBeforeSubmit();
      if (!payload) {
         setSubmissionResult(null);
         return;
      }

      setSubmitting(true);
      setError(null);
      setSubmissionResult(null);

      try {
         const response = await submitSupportRequest(payload);
         setSubmissionResult(response);
      } catch (err: any) {
         setError(
            err?.message ||
               `We couldn’t send your message. Check your connection and try again, or email ${SUPPORT_EMAIL}.`
         );
      } finally {
         setSubmitting(false);
      }
   };

   const handleRetry = async () => {
      if (!submitting) {
         await handleSubmit();
      }
   };

   const handleSendAnother = () => {
      setSubmissionResult(null);
      setError(null);
      setForm((current) => ({
         ...INITIAL_FORM,
         name: current.name || `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim(),
         email: current.email || profile?.email || "",
      }));
   };

   return (
      <View className="flex-1 bg-[#F7F8F4]">
         <View className="flex-col lg:flex-row">
            <UserHubSidebar
               activeKey="support"
               displayName={displayName}
               email={profile?.email}
               membershipLabel={membershipLabel}
               profileImage={profile?.profileImage}
            />

            <View className="flex-1 px-3 md:px-5 xl:px-6 py-4 md:py-5">
               <View className="max-w-[1480px] w-full gap-4">
                  {error && (
                     <View className="rounded-2xl border border-red-200 bg-white px-4 py-3 md:px-5 md:py-4 flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <View className="flex-row items-start gap-3 flex-1">
                           <Ionicons name="warning-outline" size={20} color="#DC2626" />
                           <Text className="flex-1 text-sm text-red-700">
                              {error}
                           </Text>
                        </View>
                        <Pressable
                           onPress={handleRetry}
                           disabled={submitting}
                           className="self-start rounded-xl border border-gray-300 bg-white px-4 py-2"
                        >
                           <Text className="text-sm font-semibold text-gray-800">
                              Retry
                           </Text>
                        </Pressable>
                     </View>
                  )}

                  <View className="relative overflow-hidden rounded-[28px] bg-primary_green px-5 md:px-6 py-5 md:py-6 shadow-sm">
                     <View className="absolute inset-0">
                        <View className="absolute -right-8 top-2 h-40 w-72 rounded-full bg-white/10" />
                        <View className="absolute right-10 top-8 h-32 w-60 rounded-full bg-emerald-200/15" />
                        <View className="absolute right-0 bottom-0 h-24 w-80 rounded-full bg-emerald-100/35" />
                     </View>

                     <View className="relative flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <View className="flex-1">
                           <Text className="flex-row items-center text-xs font-bold tracking-[0.18em] uppercase text-white/80">
                              Help Centre
                           </Text>
                           <Text className="mt-2 text-3xl font-bold text-white">
                              How can we help?
                           </Text>
                           <Text className="mt-2 text-base text-white/85">
                              Find our knowledge base or get in touch directly.
                           </Text>
                        </View>
                     </View>

                     <View className="relative mt-5 rounded-2xl bg-white/95 px-4 py-1.5 flex-row items-center gap-3">
                        <Ionicons name="search-outline" size={20} color="#9CA3AF" />
                        <TextInput
                           value={searchTerm}
                           onChangeText={setSearchTerm}
                           placeholder="Search articles & FAQs..."
                           placeholderTextColor="#9CA3AF"
                           className="h-12 flex-1 text-base text-gray-900"
                        />
                     </View>
                  </View>

                  <View className="flex-col xl:flex-row gap-4">
                     <View className="xl:w-[300px] rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm">
                        <Text className="text-2xl font-bold text-gray-900">
                           Before you send
                        </Text>

                        <View className="mt-6 gap-0">
                           <View className="flex-row gap-4 py-4 border-b border-gray-200">
                              <Ionicons name="time-outline" size={24} color="#111827" />
                              <View className="flex-1">
                                 <Text className="text-lg font-semibold text-gray-900">
                                    Typical reply time
                                 </Text>
                                 <Text className="mt-1 text-base text-gray-600">
                                    1–2 business days
                                 </Text>
                              </View>
                           </View>

                           <View className="flex-row gap-4 py-4 border-b border-gray-200">
                              <Ionicons name="mail-outline" size={24} color="#111827" />
                              <View className="flex-1">
                                 <Text className="text-lg font-semibold text-gray-900">
                                    Support email
                                 </Text>
                                 <Text className="mt-1 text-base text-gray-600">
                                    {SUPPORT_EMAIL}
                                 </Text>
                              </View>
                           </View>

                           <View className="flex-row gap-4 py-4 border-b border-gray-200">
                              <Ionicons name="image-outline" size={24} color="#111827" />
                              <View className="flex-1">
                                 <Text className="text-lg font-semibold text-gray-900">
                                    Include screenshots
                                 </Text>
                                 <Text className="mt-1 text-base text-gray-600">
                                    For faster help with bug reports
                                 </Text>
                              </View>
                           </View>

                           <View className="flex-row gap-4 py-4">
                              <Ionicons name="book-outline" size={24} color="#111827" />
                              <View className="flex-1">
                                 <Text className="text-lg font-semibold text-gray-900">
                                    Check FAQs first
                                 </Text>
                                 <Text className="mt-1 text-base text-gray-600">
                                    You might find an answer right away.
                                 </Text>
                              </View>
                           </View>
                        </View>

                        <View className="mt-6 rounded-2xl bg-[#F8FAFC] px-4 py-4">
                           <Text className="text-sm font-semibold text-gray-800">
                              Expected response time
                           </Text>
                           <Text className="mt-1 text-base text-gray-600">
                              {RESPONSE_TIME}
                           </Text>
                        </View>

                        <Pressable
                           onPress={() => {
                              setSearchTerm("");
                              setExpandedFaqId(FAQ_ITEMS[0].id);
                           }}
                           className="mt-6 h-12 rounded-2xl border border-gray-300 bg-white px-4 flex-row items-center justify-between"
                        >
                           <Text className="text-base font-semibold text-gray-900">
                              Browse FAQs
                           </Text>
                           <Ionicons name="chevron-forward" size={18} color="#111827" />
                        </Pressable>
                     </View>

                     <View className="flex-1 rounded-[28px] border border-gray-200 bg-white p-5 md:p-6 shadow-sm">
                        {!submissionResult ? (
                           <>
                              <Text className="text-xs font-bold tracking-[0.18em] uppercase text-gray-500">
                                 Contact Support
                              </Text>
                              <Text className="mt-2 text-2xl font-bold text-gray-900">
                                 Send us a message
                              </Text>
                              <Text className="mt-2 text-base text-gray-600">
                                 The more details you provide, the faster we can help.
                              </Text>

                              <View className="mt-6 gap-4">
                                 <View>
                                    <Text className="mb-2 text-sm font-semibold text-gray-700">
                                       What do you need help with? <Text className="text-red-500">*</Text>
                                    </Text>
                                    <View className="flex-row flex-wrap gap-2">
                                       {SUPPORT_TOPICS.map((topic) => {
                                          const active = form.topic === topic;
                                          return (
                                             <Pressable
                                                key={topic}
                                                onPress={() => updateField("topic", topic)}
                                                className={`rounded-full border px-4 py-2 ${
                                                   active
                                                      ? "border-primary_green bg-emerald-50"
                                                      : "border-gray-300 bg-white"
                                                }`}
                                             >
                                                <Text
                                                   className={`text-sm font-semibold ${
                                                      active ? "text-primary_green" : "text-gray-700"
                                                   }`}
                                                >
                                                   {topic}
                                                </Text>
                                             </Pressable>
                                          );
                                       })}
                                    </View>
                                    <Text className="mt-2 text-sm text-gray-500">
                                       Examples: Account, Billing, Alerts, Deals, Bug report, Other
                                    </Text>
                                 </View>

                                 <View>
                                    <Text className="mb-2 text-sm font-semibold text-gray-700">
                                       Subject <Text className="text-red-500">*</Text>
                                    </Text>
                                    <TextInput
                                       value={form.subject}
                                       onChangeText={(value) => updateField("subject", value)}
                                       placeholder="Subject"
                                       placeholderTextColor="#9CA3AF"
                                       className="h-12 rounded-2xl border border-gray-300 bg-white px-4 text-base text-gray-900"
                                    />
                                 </View>

                                 <View>
                                    <Text className="mb-2 text-sm font-semibold text-gray-700">
                                       Message <Text className="text-red-500">*</Text>
                                    </Text>
                                    <TextInput
                                       value={form.message}
                                       onChangeText={(value) => updateField("message", value)}
                                       placeholder="Tell us what happened, what you expected, and any steps to reproduce the issue."
                                       placeholderTextColor="#9CA3AF"
                                       multiline
                                       textAlignVertical="top"
                                       className="min-h-[160px] rounded-3xl border border-gray-300 bg-white px-4 py-4 text-base text-gray-900"
                                    />
                                 </View>

                                 <View className="rounded-3xl border border-dashed border-gray-300 bg-[#FCFCFA] px-5 py-5 gap-4">
                                    {Platform.OS === "web" &&
                                       React.createElement("input", {
                                          id: "support-attachment-input",
                                          type: "file",
                                          accept: "image/png,image/jpeg,application/pdf",
                                          style: { display: "none" },
                                          onChange: handleAttachmentChange,
                                       })}
                                    <View className="flex-row items-start gap-4">
                                       <Ionicons
                                          name="cloud-upload-outline"
                                          size={28}
                                          color="#111827"
                                       />
                                       <View>
                                          <Text className="text-lg font-semibold text-gray-900">
                                             Attach screenshot or file
                                          </Text>
                                          <Text className="mt-1 text-sm text-gray-500">
                                             PNG, JPG, PDF up to 10 MB
                                          </Text>
                                       </View>
                                    </View>
                                    <View className="flex-col md:flex-row md:items-center md:justify-between gap-3">
                                       {form.attachment ? (
                                          <View className="flex-1 rounded-2xl border border-emerald-100 bg-white px-4 py-3 flex-row items-center gap-3">
                                             <Ionicons
                                                name="document-attach-outline"
                                                size={20}
                                                color="#10B981"
                                             />
                                             <View className="flex-1">
                                                <Text className="text-sm font-semibold text-gray-900">
                                                   {form.attachment.name}
                                                </Text>
                                                <Text className="mt-1 text-xs text-gray-500">
                                                   {formatAttachmentSize(form.attachment.size)}
                                                </Text>
                                             </View>
                                             <Pressable
                                                onPress={clearAttachment}
                                                className="h-9 w-9 rounded-full bg-gray-100 items-center justify-center"
                                             >
                                                <Ionicons
                                                   name="close-outline"
                                                   size={20}
                                                   color="#4B5563"
                                                />
                                             </Pressable>
                                          </View>
                                       ) : (
                                          <Text className="flex-1 text-sm text-gray-500">
                                             Attach one optional file to help us understand the issue faster.
                                          </Text>
                                       )}

                                       <Pressable
                                          onPress={handleChooseAttachment}
                                          className="h-11 rounded-2xl border border-gray-300 bg-white px-4 items-center justify-center"
                                       >
                                          <Text className="text-base font-semibold text-gray-900">
                                             {form.attachment ? "Replace file" : "Choose file"}
                                          </Text>
                                       </Pressable>
                                    </View>
                                 </View>

                                 <View className="flex-col md:flex-row gap-4">
                                    <View className="flex-1">
                                       <Text className="mb-2 text-sm font-semibold text-gray-700">
                                          Name <Text className="text-red-500">*</Text>
                                       </Text>
                                       <TextInput
                                          value={form.name}
                                          onChangeText={(value) => updateField("name", value)}
                                          placeholder="Your name"
                                          placeholderTextColor="#9CA3AF"
                                          className="h-12 rounded-2xl border border-gray-300 bg-white px-4 text-base text-gray-900"
                                       />
                                    </View>
                                    <View className="flex-1">
                                       <Text className="mb-2 text-sm font-semibold text-gray-700">
                                          Reply email <Text className="text-red-500">*</Text>
                                       </Text>
                                       <TextInput
                                          value={form.email}
                                          onChangeText={(value) => updateField("email", value)}
                                          placeholder="Your email"
                                          placeholderTextColor="#9CA3AF"
                                          keyboardType="email-address"
                                          autoCapitalize="none"
                                          className="h-12 rounded-2xl border border-gray-300 bg-white px-4 text-base text-gray-900"
                                       />
                                    </View>
                                 </View>

                                 <Pressable
                                    onPress={handleSubmit}
                                    disabled={submitting}
                                    className={`h-12 rounded-2xl items-center justify-center ${
                                       submitting ? "bg-emerald-300" : "bg-primary_green"
                                    }`}
                                 >
                                    {submitting ? (
                                       <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                       <Text className="text-base font-semibold text-white">
                                          Send support request
                                       </Text>
                                    )}
                                 </Pressable>
                              </View>
                           </>
                        ) : (
                           <View className="min-h-[420px] items-start justify-center">
                              <View className="w-14 h-14 rounded-2xl bg-emerald-50 items-center justify-center">
                                 <Ionicons name="checkmark-circle-outline" size={28} color="#10B981" />
                              </View>
                              <Text className="mt-5 text-3xl font-bold text-gray-900">
                                 Your support request was sent.
                              </Text>
                              <Text className="mt-3 text-base leading-7 text-gray-600">
                                 We’ll reply to{" "}
                                 <Text className="font-semibold text-gray-900">
                                    {submissionResult.replyToEmail}
                                 </Text>{" "}
                                 within 1–2 business days.
                              </Text>

                              <View className="mt-6 rounded-2xl bg-[#F8FAFC] px-5 py-4">
                                 <Text className="text-sm font-semibold text-gray-500">
                                    Reference number
                                 </Text>
                                 <Text className="mt-2 text-xl font-bold text-gray-900">
                                    {submissionResult.referenceNumber}
                                 </Text>
                              </View>

                              <View className="mt-6 gap-3 md:flex-row">
                                 <Pressable
                                    onPress={handleSendAnother}
                                    className="h-12 rounded-2xl border border-gray-300 bg-white px-5 items-center justify-center"
                                 >
                                    <Text className="text-base font-semibold text-gray-900">
                                       Send another message
                                    </Text>
                                 </Pressable>
                                 <Pressable
                                    onPress={() => router.push("/dashboard")}
                                    className="h-12 rounded-2xl bg-primary_green px-5 items-center justify-center"
                                 >
                                    <Text className="text-base font-semibold text-white">
                                       Back to dashboard
                                    </Text>
                                 </Pressable>
                              </View>
                           </View>
                        )}
                     </View>
                  </View>

                  <View className="rounded-[28px] border border-gray-200 bg-white p-5 md:p-6 shadow-sm">
                     <View className="flex-col md:flex-row md:items-end md:justify-between gap-3">
                        <View>
                           <Text className="text-xs font-bold tracking-[0.18em] uppercase text-gray-400">
                              Frequently Asked Questions
                           </Text>
                           <Text className="mt-2 text-2xl font-bold text-gray-900">
                              Quick answers
                           </Text>
                        </View>
                        <Text className="text-sm text-gray-500">
                           {filteredFaqs.length} question{filteredFaqs.length === 1 ? "" : "s"} found
                        </Text>
                     </View>

                     <View className="mt-6 gap-3">
                        {filteredFaqs.length ? (
                           filteredFaqs.map((item) => {
                              const expanded = item.id === expandedFaqId;

                              return (
                                 <View
                                    key={item.id}
                                    className="rounded-3xl border border-gray-100 bg-[#FCFCFA] overflow-hidden"
                                 >
                                    <Pressable
                                       onPress={() =>
                                          setExpandedFaqId((current) =>
                                             current === item.id ? null : item.id
                                          )
                                       }
                                       className="flex-row items-center justify-between px-4 md:px-5 py-4"
                                    >
                                       <Text className="flex-1 pr-4 text-base font-semibold text-gray-900">
                                          {item.question}
                                       </Text>
                                       <Ionicons
                                          name={expanded ? "chevron-up" : "chevron-down"}
                                          size={18}
                                          color="#10B981"
                                       />
                                    </Pressable>

                                    {expanded && (
                                       <View className="px-4 md:px-5 pb-4">
                                          <Text className="text-sm leading-6 text-gray-600">
                                             {item.answer}
                                          </Text>
                                       </View>
                                    )}
                                 </View>
                              );
                           })
                        ) : (
                           <View className="rounded-3xl border border-dashed border-gray-200 bg-[#FCFCFA] px-5 py-8">
                              <Text className="text-base font-semibold text-gray-900">
                                 No matching FAQs
                              </Text>
                              <Text className="mt-2 text-sm leading-6 text-gray-500">
                                 Try a different search term, or send us a support request by
                                 email above.
                              </Text>
                           </View>
                        )}
                     </View>
                  </View>
               </View>
            </View>
         </View>
      </View>
   );
}
