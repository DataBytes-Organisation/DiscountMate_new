import React, { useEffect, useState } from "react";
import {
   View,
   Text,
   Modal,
   Pressable,
   TextInput,
   KeyboardAvoidingView,
   Platform,
   ScrollView,
} from "react-native";
import type { ShoppingList, ShoppingListAccent } from "../../types/ShoppingList";
import { accentDot } from "./accentStyles";

const ACCENTS: ShoppingListAccent[] = ["emerald", "amber", "sky", "violet", "rose"];

type EditShoppingListModalProps = {
   visible: boolean;
   onClose: () => void;
   /** When null, modal is in “create” mode */
   editingList: ShoppingList | null;
   onSave: (payload: { name: string; description: string; accent: ShoppingListAccent }) => void;
};

export default function EditShoppingListModal({
   visible,
   onClose,
   editingList,
   onSave,
}: EditShoppingListModalProps) {
   const [name, setName] = useState("");
   const [description, setDescription] = useState("");
   const [accent, setAccent] = useState<ShoppingListAccent>("emerald");

   useEffect(() => {
      if (!visible) return;
      if (editingList) {
         setName(editingList.name);
         setDescription(editingList.description);
         setAccent(editingList.accent);
      } else {
         setName("");
         setDescription("");
         setAccent("emerald");
      }
   }, [visible, editingList]);

   const title = editingList ? "Edit list" : "New list";

   const handleSave = () => {
      onSave({
         name: name.trim() || "Untitled list",
         description: description.trim(),
         accent,
      });
      onClose();
   };

   return (
      <Modal visible={visible} animationType="fade" transparent>
         <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1 justify-center items-center bg-black/40 px-4"
         >
            <Pressable className="absolute inset-0" onPress={onClose} accessibilityRole="button" />
            <View className="w-full max-w-md bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden z-10">
               <View className="px-5 pt-5 pb-3 border-b border-gray-100">
                  <Text className="text-xl font-bold text-gray-900">{title}</Text>
                  <Text className="text-sm text-gray-600 mt-1">
                     Name and colour help you spot lists quickly. Sync will come with the API.
                  </Text>
               </View>
               <ScrollView
                  className="max-h-[70vh] px-5 py-4"
                  keyboardShouldPersistTaps="handled"
               >
                  <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">Name</Text>
                  <TextInput
                     value={name}
                     onChangeText={setName}
                     placeholder="e.g. Weekly shop"
                     placeholderTextColor="#9CA3AF"
                     className="border border-gray-200 rounded-xl px-3 py-3 text-gray-900 mb-4"
                  />
                  <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">
                     Description
                  </Text>
                  <TextInput
                     value={description}
                     onChangeText={setDescription}
                     placeholder="Optional notes"
                     placeholderTextColor="#9CA3AF"
                     multiline
                     className="border border-gray-200 rounded-xl px-3 py-3 text-gray-900 mb-4 min-h-[88px]"
                     textAlignVertical="top"
                  />
                  <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">Accent</Text>
                  <View className="flex-row flex-wrap gap-2 mb-2">
                     {ACCENTS.map((a) => {
                        const selected = accent === a;
                        return (
                           <Pressable
                              key={a}
                              onPress={() => setAccent(a)}
                              className={`flex-row items-center gap-2 px-3 py-2 rounded-xl border ${
                                 selected
                                    ? "border-primary_green bg-primary_green/10"
                                    : "border-gray-200 bg-gray-50"
                              }`}
                           >
                              <View className={`w-3 h-3 rounded-full ${accentDot[a]}`} />
                              <Text
                                 className={`text-sm capitalize font-medium ${
                                    selected ? "text-primary_green" : "text-gray-700"
                                 }`}
                              >
                                 {a}
                              </Text>
                           </Pressable>
                        );
                     })}
                  </View>
               </ScrollView>
               <View className="flex-row gap-3 px-5 py-4 border-t border-gray-100">
                  <Pressable
                     onPress={onClose}
                     className="flex-1 py-3 rounded-xl border border-gray-200 items-center"
                  >
                     <Text className="font-semibold text-gray-700">Cancel</Text>
                  </Pressable>
                  <Pressable
                     onPress={handleSave}
                     className="flex-1 py-3 rounded-xl bg-primary_green items-center"
                  >
                     <Text className="font-semibold text-white">Save</Text>
                  </Pressable>
               </View>
            </View>
         </KeyboardAvoidingView>
      </Modal>
   );
}
