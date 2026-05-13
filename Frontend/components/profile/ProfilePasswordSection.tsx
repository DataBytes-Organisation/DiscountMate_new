import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { validatePasswordStrength } from "../../utils/profileValidation";

type Props = {
   saving?: boolean;
   onSubmit?: (payload: {
      currentPassword: string;
      newPassword: string;
      confirmNewPassword: string;
   }) => Promise<void> | void;
};

const EMPTY_FORM = {
   currentPassword: "",
   newPassword: "",
   confirmNewPassword: "",
};

export default function ProfilePasswordSection({
   saving,
   onSubmit,
}: Props): JSX.Element {
   const [form, setForm] = useState(EMPTY_FORM);
   const [error, setError] = useState<string | null>(null);

   const updateField = (key: keyof typeof EMPTY_FORM, value: string) => {
      setForm((current) => ({
         ...current,
         [key]: value,
      }));
   };

   const handleSubmit = async () => {
      setError(null);

      if (
         !form.currentPassword.trim() ||
         !form.newPassword.trim() ||
         !form.confirmNewPassword.trim()
      ) {
         setError("Fill in all password fields to continue.");
         return;
      }

      if (form.newPassword.length < 8) {
         setError("New password must be at least 8 characters long.");
         return;
      }

      const passwordValidationMessage = validatePasswordStrength(form.newPassword);
      if (passwordValidationMessage) {
         setError(passwordValidationMessage);
         return;
      }

      if (form.newPassword !== form.confirmNewPassword) {
         setError("New passwords do not match.");
         return;
      }

      try {
         await onSubmit?.(form);
         setForm(EMPTY_FORM);
      } catch (submitError) {
         // The parent page surfaces API errors. Keep this form populated.
      }
   };

   const fields: Array<{
      key: keyof typeof EMPTY_FORM;
      label: string;
      placeholder: string;
   }> = [
      {
         key: "currentPassword",
         label: "Current Password",
         placeholder: "Enter your current password",
      },
      {
         key: "newPassword",
         label: "New Password",
         placeholder: "Enter your new password",
      },
      {
         key: "confirmNewPassword",
         label: "Confirm New Password",
         placeholder: "Re-enter your new password",
      },
   ];

   return (
      <View className="rounded-[28px] border border-[#EAE7E0] bg-white overflow-hidden shadow-sm">
         <View className="border-b border-[#F0EDE7] px-5 py-4 md:px-6">
            <View className="flex-row items-center gap-3">
               <View className="w-10 h-10 rounded-2xl bg-emerald-50 items-center justify-center">
                  <Ionicons name="lock-closed-outline" size={18} color="#10B981" />
               </View>
               <View>
                  <Text className="text-lg font-bold text-[#1F2937]">
                     Change Password
                  </Text>
                  <Text className="text-sm text-[#9CA3AF] mt-1">
                     Use at least 8 characters and include 1 special character.
                  </Text>
               </View>
            </View>
         </View>

         <View className="px-5 py-5 md:px-6 md:py-6">
            <View className="gap-4">
               {fields.map((field) => (
                  <View key={field.key} className="gap-2">
                     <Text className="text-sm font-semibold text-[#6B7280]">
                        {field.label}
                     </Text>
                     <View className="rounded-2xl border border-[#E7E3DB] bg-[#FBFAF8] px-4 py-1.5">
                        <TextInput
                           value={form[field.key]}
                           onChangeText={(text) => updateField(field.key, text)}
                           secureTextEntry
                           autoCapitalize="none"
                           placeholder={field.placeholder}
                           placeholderTextColor="#9CA3AF"
                           className="text-base text-[#1F2937] py-3"
                        />
                     </View>
                  </View>
               ))}
            </View>

            {error && (
               <View className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                  <Text className="text-sm text-red-700">{error}</Text>
               </View>
            )}

            <Pressable
               onPress={handleSubmit}
               disabled={saving}
               className={`mt-5 self-start rounded-2xl px-5 py-3 ${
                  saving ? "bg-emerald-300" : "bg-primary_green"
               }`}
            >
               <Text className="text-sm font-semibold text-white">
                  {saving ? "Updating..." : "Update Password"}
               </Text>
            </Pressable>
         </View>
      </View>
   );
}
