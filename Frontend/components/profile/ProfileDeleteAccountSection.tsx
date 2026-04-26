import React, { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

type Props = {
   deleting?: boolean;
   onDelete?: () => Promise<void> | void;
};

export default function ProfileDeleteAccountSection({
   deleting,
   onDelete,
}: Props): JSX.Element {
   const [confirmed, setConfirmed] = useState(false);
   const [showConfirmModal, setShowConfirmModal] = useState(false);

   const handleOpenConfirmModal = () => {
      if (!confirmed || deleting) {
         return;
      }

      setShowConfirmModal(true);
   };

   const handleDelete = async () => {
      if (!confirmed || deleting) {
         return;
      }

      try {
         await onDelete?.();
      } finally {
         setShowConfirmModal(false);
         setConfirmed(false);
      }
   };

   return (
      <View className="rounded-[28px] border border-[#F4D6D6] bg-white overflow-hidden shadow-sm">
         <View className="border-b border-[#F7E7E7] px-5 py-4 md:px-6">
            <View className="flex-row items-center gap-3">
               <View className="w-10 h-10 rounded-2xl bg-rose-50 items-center justify-center">
                  <Ionicons name="warning-outline" size={18} color="#F97373" />
               </View>
               <View>
                  <Text className="text-lg font-bold text-[#1F2937]">
                     Delete Account
                  </Text>
                  <Text className="text-sm text-[#9CA3AF] mt-1">
                     Permanently remove your account and associated data.
                  </Text>
               </View>
            </View>
         </View>

         <View className="px-5 py-5 md:px-6 md:py-6">
            <Text className="text-sm leading-6 text-[#6B7280]">
               Permanently remove your account, saved preferences, price alerts,
               and all associated data. This action cannot be undone.
            </Text>

            <Pressable
               onPress={() => setConfirmed((current) => !current)}
               className="mt-4 flex-row items-start gap-3"
            >
               <View
                  className={`mt-0.5 h-5 w-5 rounded-md border items-center justify-center ${
                     confirmed
                        ? "border-rose-500 bg-rose-500"
                        : "border-[#D1D5DB] bg-white"
                  }`}
               >
                  {confirmed && (
                     <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  )}
               </View>
               <Text className="flex-1 text-sm text-[#6B7280] leading-6">
                  I understand this will permanently delete my account and all
                  data, and this action cannot be reversed.
               </Text>
            </Pressable>

            <Pressable
               onPress={handleOpenConfirmModal}
               disabled={!confirmed || deleting}
               className={`mt-5 self-start rounded-2xl px-5 py-3 ${
                  confirmed && !deleting
                     ? "bg-rose-500"
                     : "bg-[#F3F4F6]"
               }`}
            >
               <Text
                  className={`text-sm font-semibold ${
                     confirmed && !deleting ? "text-white" : "text-[#9CA3AF]"
                  }`}
               >
                  {deleting ? "Deleting..." : "Delete My Account"}
               </Text>
            </Pressable>
         </View>

         <Modal
            visible={showConfirmModal}
            transparent
            animationType="fade"
            onRequestClose={() => {
               if (!deleting) {
                  setShowConfirmModal(false);
               }
            }}
         >
            <View className="flex-1 bg-black/45 items-center justify-center px-4">
               <Pressable
                  className="absolute inset-0"
                  onPress={() => {
                     if (!deleting) {
                        setShowConfirmModal(false);
                     }
                  }}
               />

               <View className="w-full max-w-[460px] rounded-[28px] border border-[#F4D6D6] bg-white px-6 py-6 shadow-2xl">
                  <View className="items-center">
                     <View className="w-16 h-16 rounded-full bg-rose-50 items-center justify-center">
                        <Ionicons name="warning" size={30} color="#F43F5E" />
                     </View>
                     <Text className="mt-4 text-xl font-bold text-[#1F2937] text-center">
                        Are you sure?
                     </Text>
                     <Text className="mt-3 text-sm leading-6 text-[#6B7280] text-center">
                        Deleting your account will permanently remove your profile,
                        saved preferences, price alerts, and related account data.
                        This action cannot be undone.
                     </Text>
                  </View>

                  <View className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 flex-row gap-3">
                     <Ionicons name="alert-circle-outline" size={20} color="#F43F5E" />
                     <Text className="flex-1 text-sm leading-6 text-rose-700">
                        Please confirm only if you are certain you want to permanently
                        delete this account.
                     </Text>
                  </View>

                  <View className="mt-6 flex-row flex-wrap gap-3 justify-end">
                     <Pressable
                        onPress={() => setShowConfirmModal(false)}
                        disabled={deleting}
                        className="rounded-2xl border border-[#E5E7EB] px-5 py-3"
                     >
                        <Text className="text-sm font-semibold text-[#6B7280]">
                           Cancel
                        </Text>
                     </Pressable>
                     <Pressable
                        onPress={handleDelete}
                        disabled={deleting}
                        className={`rounded-2xl px-5 py-3 ${
                           deleting ? "bg-rose-300" : "bg-rose-500"
                        }`}
                     >
                        <Text className="text-sm font-semibold text-white">
                           {deleting ? "Deleting..." : "Yes, Delete Account"}
                        </Text>
                     </Pressable>
                  </View>
               </View>
            </View>
         </Modal>
      </View>
   );
}
