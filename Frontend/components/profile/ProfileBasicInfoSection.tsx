import React, { useEffect, useMemo, useState } from "react";
import {
   View,
   Text,
   TextInput,
   Pressable,
   Image,
   ActivityIndicator,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
   AddressSuggestion,
   fetchAustralianAddressSuggestions,
} from "../../services/profile";
import { UserProfile } from "../../types/UserProfile";
import {
   normalizeAustralianPhoneNumber,
   ProfileFieldErrorMap,
   validateProfileForm,
} from "../../utils/profileValidation";

type Props = {
   user?: UserProfile | null;
   loading?: boolean;
   saving?: boolean;
   membershipLabel?: string;
   profileImage?: string | null;
   onAvatarPress?: () => void;
   avatarUploading?: boolean;
   onSave?: (nextProfile: UserProfile) => Promise<void> | void;
};

type EditableField = "firstName" | "lastName" | "phoneNumber" | "address" | "postcode";

const EMPTY_PROFILE: UserProfile = {
   firstName: "",
   lastName: "",
   email: "",
   emailVerified: false,
   phoneNumber: "",
   phoneVerified: false,
   postcode: "",
   address: "",
};

function getInitials(name: string): string {
   const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

   if (parts.length === 0) {
      return "DM";
   }

   return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function clearFieldError(
   currentErrors: ProfileFieldErrorMap,
   field: EditableField
): ProfileFieldErrorMap {
   if (!currentErrors[field]) {
      return currentErrors;
   }

   const nextErrors = { ...currentErrors };
   delete nextErrors[field];
   return nextErrors;
}

function ProfileBasicInfoSection({
   user,
   loading,
   saving,
   membershipLabel,
   profileImage,
   onAvatarPress,
   avatarUploading,
   onSave,
}: Props): JSX.Element {
   const [isEditing, setIsEditing] = useState(false);
   const [userInfo, setUserInfo] = useState<UserProfile>(EMPTY_PROFILE);
   const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrorMap>({});
   const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
   const [addressLookupLoading, setAddressLookupLoading] = useState(false);
   const [addressLookupError, setAddressLookupError] = useState<string | null>(null);
   const [addressSearchEnabled, setAddressSearchEnabled] = useState(false);

   useEffect(() => {
      if (user) {
         setUserInfo({
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
            email: user.email ?? "",
            emailVerified: user.emailVerified ?? Boolean(user.email),
            phoneNumber: user.phoneNumber ?? "",
            phoneVerified: user.phoneVerified ?? Boolean(user.phoneNumber),
            postcode: user.postcode ?? "",
            address: user.address ?? "",
         });
      }

      setFieldErrors({});
      setAddressSuggestions([]);
      setAddressLookupError(null);
      setAddressSearchEnabled(false);
   }, [user]);

   useEffect(() => {
      if (!isEditing) {
         setAddressSuggestions([]);
         setAddressLookupError(null);
         setAddressLookupLoading(false);
         setAddressSearchEnabled(false);
         return;
      }

      if (!addressSearchEnabled) {
         return;
      }

      const query = String(userInfo.address || "").trim();
      if (query.length < 3) {
         setAddressSuggestions([]);
         setAddressLookupError(null);
         setAddressLookupLoading(false);
         return;
      }

      let active = true;
      setAddressLookupLoading(true);
      setAddressSuggestions([]);
      const timer = setTimeout(async () => {
         setAddressLookupError(null);

         try {
            const suggestions = await fetchAustralianAddressSuggestions(query);
            if (active) {
               setAddressSuggestions(suggestions);
            }
         } catch (error: any) {
            if (active) {
               setAddressSuggestions([]);
               setAddressLookupError(
                  error?.message || "Unable to load Australian address suggestions."
               );
            }
         } finally {
            if (active) {
               setAddressLookupLoading(false);
            }
         }
      }, 350);

      return () => {
         active = false;
         clearTimeout(timer);
      };
   }, [addressSearchEnabled, isEditing, userInfo.address]);

   const info = userInfo || EMPTY_PROFILE;
   const displayName = useMemo(() => {
      return `${info.firstName ?? ""} ${info.lastName ?? ""}`.trim() || "DiscountMate Member";
   }, [info.firstName, info.lastName]);

   const readOnlyValue = (value?: string) =>
      value && value.trim().length > 0 ? value : loading ? "Loading..." : "Not provided";

   const updateField = (field: EditableField, value: string) => {
      setUserInfo((current) => ({
         ...current,
         [field]: value,
      }));
      setFieldErrors((current) => clearFieldError(current, field));

      if (field === "address") {
         setAddressSearchEnabled(true);
         setAddressLookupError(null);
      }
   };

   const selectAddressSuggestion = (suggestion: AddressSuggestion) => {
      setUserInfo((current) => ({
         ...current,
         address: suggestion.address || suggestion.label,
         postcode: suggestion.postcode || current.postcode || "",
      }));
      setFieldErrors((current) => {
         let nextErrors = clearFieldError(current, "address");
         nextErrors = clearFieldError(nextErrors, "postcode");
         return nextErrors;
      });
      setAddressSuggestions([]);
      setAddressLookupError(null);
      setAddressSearchEnabled(false);
   };

   const fields = [
      {
         key: "firstName" as const,
         label: "First Name",
         placeholder: "Enter your first name",
         icon: "person-outline",
      },
      {
         key: "lastName" as const,
         label: "Last Name",
         placeholder: "Enter your last name",
         icon: "person-outline",
      },
      {
         key: "phoneNumber" as const,
         label: "Phone Number",
         placeholder: "Enter your Australian phone number",
         icon: "call-outline",
      },
      {
         key: "address" as const,
         label: "Address",
         placeholder: "Start typing your Australian address",
         icon: "location-outline",
      },
   ];

   return (
      <View className="rounded-[28px] border border-[#EAE7E0] bg-white overflow-hidden shadow-sm">
         <View className="border-b border-[#F0EDE7] px-5 py-4 md:px-6">
            <View className="flex-row items-center gap-3">
               <View>
                  <Text className="text-lg font-bold text-[#1F2937]">
                     Update Profile
                  </Text>
               </View>
            </View>
         </View>

         <View className="px-5 py-5 md:px-6 md:py-6">
            <View className="flex-row flex-wrap -mx-2">
               {fields.map((field) => {
                  const value = info[field.key];
                  const hasFieldError = fieldErrors[field.key];

                  return (
                     <View key={field.key} className="w-full lg:w-1/2 px-2 mb-4">
                        <View className="gap-2">
                           <Text className="text-sm font-semibold text-[#6B7280]">
                              {field.label}
                           </Text>
                           <View
                              className={`rounded-2xl border bg-[#FBFAF8] px-4 py-1.5 ${
                                 hasFieldError ? "border-rose-300" : "border-[#E7E3DB]"
                              }`}
                           >
                              {isEditing ? (
                                 <TextInput
                                    value={String(value || "")}
                                    onChangeText={(text) => updateField(field.key, text)}
                                    keyboardType={
                                       field.key === "phoneNumber" ? "phone-pad" : "default"
                                    }
                                    autoCapitalize={
                                       field.key === "address" ? "words" : "sentences"
                                    }
                                    placeholder={field.placeholder}
                                    placeholderTextColor="#9CA3AF"
                                    className="text-base text-[#1F2937] py-3"
                                 />
                              ) : (
                                 <View className="flex-row items-center gap-3 py-3 min-h-[52px]">
                                    <Ionicons
                                       name={field.icon}
                                       size={18}
                                       color="#9CA3AF"
                                    />
                                    <Text className="flex-1 text-base text-[#4B5563]">
                                       {readOnlyValue(String(value || ""))}
                                    </Text>
                                 </View>
                              )}
                           </View>

                           {field.key === "address" && isEditing && (
                              <View className="gap-2">
                                 <Text className="text-xs text-[#9CA3AF]">
                                    Search Australian addresses and tap a match to auto-fill.
                                 </Text>

                                 {addressLookupLoading && (
                                    <View className="flex-row items-center gap-2">
                                       <ActivityIndicator size="small" color="#10B981" />
                                       <Text className="text-xs text-[#6B7280]">
                                          Searching Australian addresses...
                                       </Text>
                                    </View>
                                 )}

                                 {addressLookupError && (
                                    <Text className="text-xs text-rose-600">
                                       {addressLookupError}
                                    </Text>
                                 )}

                                 {!addressLookupLoading &&
                                    !addressLookupError &&
                                    addressSearchEnabled &&
                                    String(info.address || "").trim().length >= 3 &&
                                    addressSuggestions.length === 0 && (
                                       <Text className="text-xs text-[#9CA3AF]">
                                          No Australian address matches found yet.
                                       </Text>
                                    )}

                                 {addressSuggestions.length > 0 && (
                                    <View className="rounded-2xl border border-[#E7E3DB] bg-white overflow-hidden">
                                       {addressSuggestions.map((suggestion, index) => (
                                          <Pressable
                                             key={`${suggestion.label}-${index}`}
                                             onPress={() => selectAddressSuggestion(suggestion)}
                                             className={`px-4 py-3 ${
                                                index < addressSuggestions.length - 1
                                                   ? "border-b border-[#F0EDE7]"
                                                   : ""
                                             }`}
                                          >
                                             <Text className="text-sm font-semibold text-[#1F2937]">
                                                {suggestion.label}
                                             </Text>
                                             {(suggestion.state || suggestion.postcode) && (
                                                <Text className="mt-1 text-xs text-[#9CA3AF]">
                                                   {[suggestion.state, suggestion.postcode]
                                                      .filter(Boolean)
                                                      .join(" • ")}
                                                </Text>
                                             )}
                                          </Pressable>
                                       ))}
                                    </View>
                                 )}
                              </View>
                           )}

                           {hasFieldError && (
                              <Text className="text-xs text-rose-600">{hasFieldError}</Text>
                           )}
                        </View>
                     </View>
                  );
               })}
            </View>

            <View className="mb-4">
               <View className="gap-2">
                  <Text className="text-sm font-semibold text-[#6B7280]">
                     Email Address
                  </Text>
                  <View className="rounded-2xl border border-[#E7E3DB] bg-[#FBFAF8] px-4">
                     <View className="flex-row items-center gap-3 py-3 min-h-[52px]">
                        <Ionicons name="mail-outline" size={18} color="#9CA3AF" />
                        <Text className="flex-1 text-base text-[#4B5563]">
                           {readOnlyValue(info.email)}
                        </Text>
                        {info.emailVerified && (
                           <View className="rounded-full bg-emerald-50 px-3 py-1.5">
                              <Text className="text-xs font-semibold text-primary_green">
                                 Verified
                              </Text>
                           </View>
                        )}
                     </View>
                  </View>
               </View>
            </View>

            {(isEditing || String(info.postcode || "").trim()) && (
               <View className="mb-4">
                  <View className="gap-2">
                     <Text className="text-sm font-semibold text-[#6B7280]">
                        Postcode
                     </Text>
                     <View
                        className={`rounded-2xl border bg-[#FBFAF8] px-4 py-1.5 ${
                           fieldErrors.postcode ? "border-rose-300" : "border-[#E7E3DB]"
                        }`}
                     >
                        {isEditing ? (
                           <TextInput
                              value={info.postcode}
                              onChangeText={(text) => updateField("postcode", text)}
                              keyboardType="number-pad"
                              placeholder="Enter your postcode"
                              placeholderTextColor="#9CA3AF"
                              className="text-base text-[#1F2937] py-3"
                           />
                        ) : (
                           <View className="flex-row items-center gap-3 py-3 min-h-[52px]">
                              <Ionicons name="business-outline" size={18} color="#9CA3AF" />
                              <Text className="text-base text-[#4B5563]">
                                 {readOnlyValue(info.postcode)}
                              </Text>
                           </View>
                        )}
                     </View>
                     {fieldErrors.postcode && (
                        <Text className="text-xs text-rose-600">
                           {fieldErrors.postcode}
                        </Text>
                     )}
                  </View>
               </View>
            )}

            <View className="flex-row items-center gap-3 mt-2">
               {isEditing ? (
                  <>
                     <Pressable
                        onPress={() => {
                           setIsEditing(false);
                           setFieldErrors({});
                           setAddressSuggestions([]);
                           setAddressLookupError(null);
                           setAddressSearchEnabled(false);
                           if (user) {
                              setUserInfo({
                                 firstName: user.firstName ?? "",
                                 lastName: user.lastName ?? "",
                                 email: user.email ?? "",
                                 emailVerified:
                                    user.emailVerified ?? Boolean(user.email),
                                 phoneNumber: user.phoneNumber ?? "",
                                 phoneVerified:
                                    user.phoneVerified ?? Boolean(user.phoneNumber),
                                 postcode: user.postcode ?? "",
                                 address: user.address ?? "",
                              });
                           }
                        }}
                        className="rounded-2xl border border-[#E5E7EB] px-5 py-3"
                     >
                        <Text className="text-sm font-semibold text-[#6B7280]">
                           Cancel
                        </Text>
                     </Pressable>
                     <Pressable
                        onPress={async () => {
                           const errors = validateProfileForm({
                              firstName: info.firstName,
                              lastName: info.lastName,
                              phoneNumber: info.phoneNumber,
                              address: info.address,
                              postcode: info.postcode,
                           });

                           if (Object.keys(errors).length > 0) {
                              setFieldErrors(errors);
                              return;
                           }

                           const normalizedPhoneNumber = normalizeAustralianPhoneNumber(
                              info.phoneNumber
                           );

                           const nextProfile: UserProfile = {
                              ...info,
                              firstName: String(info.firstName || "").trim(),
                              lastName: String(info.lastName || "").trim(),
                              phoneNumber:
                                 normalizedPhoneNumber === null
                                    ? info.phoneNumber
                                    : normalizedPhoneNumber,
                              address: String(info.address || "").trim(),
                              postcode: String(info.postcode || "").trim(),
                           };

                           try {
                              await onSave?.(nextProfile);
                              setUserInfo(nextProfile);
                              setAddressSuggestions([]);
                              setAddressLookupError(null);
                              setAddressSearchEnabled(false);
                              setIsEditing(false);
                           } catch (error) {
                              // Keep the form open so the parent page can surface the failure.
                           }
                        }}
                        disabled={saving}
                        className={`rounded-2xl px-5 py-3 ${
                           saving ? "bg-emerald-300" : "bg-primary_green"
                        }`}
                     >
                        <Text className="text-sm font-semibold text-white">
                           {saving ? "Saving..." : "Save Changes"}
                        </Text>
                     </Pressable>
                  </>
               ) : (
                  <Pressable
                     onPress={() => setIsEditing(true)}
                     className="rounded-2xl bg-[#F3F4F6] px-5 py-3"
                  >
                     <Text className="text-sm font-semibold text-[#374151]">
                        Edit Profile
                     </Text>
                  </Pressable>
               )}
            </View>
         </View>
      </View>
   );
}

export default ProfileBasicInfoSection;
