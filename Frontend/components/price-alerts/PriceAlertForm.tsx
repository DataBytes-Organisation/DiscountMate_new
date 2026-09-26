import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { ApiProduct, fetchProductsPage } from "../home/ProductGrid";
import { PriceAlert, PriceAlertCondition, PriceAlertInput } from "../../types/PriceAlert";
import { CONDITION_LABELS, validatePriceAlertInput } from "../../utils/priceAlertValidation";

type PriceAlertFormProps = {
   visible: boolean;
   editingAlert: PriceAlert | null;
   existingAlerts: PriceAlert[];
   onClose: () => void;
   onSave: (input: PriceAlertInput) => Promise<void>;
};

const CONDITIONS: PriceAlertCondition[] = ["price_at_or_below", "percent_off_at_least"];

export default function PriceAlertForm({
   visible,
   editingAlert,
   existingAlerts,
   onClose,
   onSave,
}: PriceAlertFormProps) {
   const [productCode, setProductCode] = useState("");
   const [productName, setProductName] = useState("");
   const [query, setQuery] = useState("");
   const [results, setResults] = useState<ApiProduct[]>([]);
   const [searching, setSearching] = useState(false);
   const [condition, setCondition] = useState<PriceAlertCondition>("price_at_or_below");
   const [threshold, setThreshold] = useState("");
   const [email, setEmail] = useState(true);
   const [push, setPush] = useState(true);
   const [errors, setErrors] = useState<Record<string, string>>({});
   const [formError, setFormError] = useState<string | null>(null);
   const [saving, setSaving] = useState(false);

   const isEditing = Boolean(editingAlert);

   useEffect(() => {
      if (!visible) return;
      setProductCode(editingAlert?.productCode ?? "");
      setProductName(editingAlert?.productName ?? "");
      setQuery("");
      setResults([]);
      setCondition(editingAlert?.condition ?? "price_at_or_below");
      setThreshold(editingAlert ? String(editingAlert.threshold) : "");
      setEmail(editingAlert?.channels.email ?? true);
      setPush(editingAlert?.channels.push ?? true);
      setErrors({});
      setFormError(null);
   }, [visible, editingAlert]);

   useEffect(() => {
      if (!visible || productCode || query.trim().length < 2) {
         setResults([]);
         return;
      }

      let active = true;
      setSearching(true);
      const timer = setTimeout(async () => {
         try {
            const { items } = await fetchProductsPage(1, 8, undefined, query);
            if (active) {
               setResults(items.filter((item) => item.product_code));
            }
         } catch {
            if (active) {
               setResults([]);
            }
         } finally {
            if (active) {
               setSearching(false);
            }
         }
      }, 350);

      return () => {
         active = false;
         clearTimeout(timer);
      };
   }, [visible, productCode, query]);

   const handleSave = async () => {
      const nextErrors = validatePriceAlertInput(
         {
            productCode,
            condition,
            threshold,
            channels: { email, push },
            editingId: editingAlert?.id,
         },
         existingAlerts
      );
      setErrors(nextErrors);
      setFormError(null);
      if (Object.keys(nextErrors).length > 0) {
         return;
      }

      setSaving(true);
      try {
         await onSave({
            productCode,
            condition,
            threshold: Number(threshold),
            channels: { email, push },
         });
         onClose();
      } catch (err: any) {
         setErrors(err?.fieldErrors ?? {});
         setFormError(err?.message || "Unable to save price alert.");
      } finally {
         setSaving(false);
      }
   };

   const renderCheckbox = (label: string, checked: boolean, onToggle: () => void) => (
      <Pressable onPress={onToggle} disabled={saving} className="flex-row items-center gap-3 min-h-[44px]">
         <View
            className={`w-5 h-5 rounded border items-center justify-center ${
               checked ? "bg-primary_green border-primary_green" : "bg-white border-gray-300"
            }`}
         >
            {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
         </View>
         <Text className="text-sm text-gray-700">{label}</Text>
      </Pressable>
   );

   return (
      <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
         <View className="flex-1 justify-center items-center bg-black/40 px-4">
            <View className="w-full max-w-md bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
               <View className="px-5 pt-5 pb-3 border-b border-gray-100">
                  <Text className="text-xl font-bold text-gray-900">
                     {isEditing ? "Edit price alert" : "New price alert"}
                  </Text>
               </View>

               <ScrollView className="max-h-[70vh] px-5 py-4" keyboardShouldPersistTaps="handled">
                  {formError && (
                     <View className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                        <Text className="text-sm text-red-700">{formError}</Text>
                     </View>
                  )}

                  <Text className="text-sm font-medium text-gray-700 mb-1">Product</Text>
                  {productCode ? (
                     <View className="flex-row items-center gap-3 border border-gray-200 rounded-xl px-3 py-3 bg-gray-50">
                        <View className="flex-1">
                           <Text className="text-sm font-semibold text-gray-900">{productName}</Text>
                           <Text className="text-xs text-gray-500">Code {productCode}</Text>
                        </View>
                        {!isEditing && (
                           <Pressable onPress={() => setProductCode("")} disabled={saving}>
                              <Ionicons name="close-circle" size={20} color="#6B7280" />
                           </Pressable>
                        )}
                     </View>
                  ) : (
                     <View>
                        <TextInput
                           value={query}
                           onChangeText={setQuery}
                           placeholder="Search for a product..."
                           placeholderTextColor="#9CA3AF"
                           autoCapitalize="none"
                           className="border border-gray-200 rounded-xl px-3 py-3 text-gray-900"
                        />
                        {searching && <Text className="mt-2 text-xs text-gray-500">Searching...</Text>}
                        {results.map((item) => (
                           <Pressable
                              key={item._id}
                              onPress={() => {
                                 setProductCode(String(item.product_code));
                                 setProductName(item.product_name || `Product ${item.product_code}`);
                              }}
                              className="px-3 py-3 border-b border-gray-100"
                           >
                              <Text className="text-sm text-gray-900">{item.product_name}</Text>
                              <Text className="text-xs text-gray-400">Code {item.product_code}</Text>
                           </Pressable>
                        ))}
                     </View>
                  )}
                  {errors.product && <Text className="text-xs text-red-600 mt-1">{errors.product}</Text>}

                  <Text className="text-sm font-medium text-gray-700 mb-1 mt-4">Alert me when</Text>
                  <View className="flex-row gap-2">
                     {CONDITIONS.map((option) => (
                        <Pressable
                           key={option}
                           onPress={() => setCondition(option)}
                           disabled={saving}
                           className={`flex-1 min-h-[44px] justify-center px-3 rounded-xl border ${
                              condition === option
                                 ? "border-primary_green bg-primary_green/10"
                                 : "border-gray-200 bg-gray-50"
                           }`}
                        >
                           <Text className="text-sm text-gray-700">{CONDITION_LABELS[option]}</Text>
                        </Pressable>
                     ))}
                  </View>
                  {errors.condition && <Text className="text-xs text-red-600 mt-1">{errors.condition}</Text>}

                  <Text className="text-sm font-medium text-gray-700 mb-1 mt-4">
                     {condition === "percent_off_at_least" ? "Minimum discount (%)" : "Target price ($)"}
                  </Text>
                  <TextInput
                     value={threshold}
                     onChangeText={setThreshold}
                     placeholder={condition === "percent_off_at_least" ? "25" : "0.00"}
                     placeholderTextColor="#9CA3AF"
                     keyboardType="decimal-pad"
                     editable={!saving}
                     className="border border-gray-200 rounded-xl px-3 py-3 text-gray-900"
                  />
                  {errors.threshold && <Text className="text-xs text-red-600 mt-1">{errors.threshold}</Text>}

                  <Text className="text-sm font-medium text-gray-700 mb-1 mt-4">Notify me by</Text>
                  {renderCheckbox("Email notifications", email, () => setEmail(!email))}
                  {renderCheckbox("Push notifications", push, () => setPush(!push))}
                  {errors.channels && <Text className="text-xs text-red-600 mt-1">{errors.channels}</Text>}
                  {errors.duplicate && <Text className="text-xs text-red-600 mt-3">{errors.duplicate}</Text>}
               </ScrollView>

               <View className="flex-row gap-3 px-5 py-4 border-t border-gray-100">
                  <Pressable
                     onPress={onClose}
                     disabled={saving}
                     className="flex-1 min-h-[44px] rounded-xl border border-gray-200 items-center justify-center"
                  >
                     <Text className="font-semibold text-gray-700">Cancel</Text>
                  </Pressable>
                  <Pressable
                     onPress={handleSave}
                     disabled={saving}
                     className="flex-1 min-h-[44px] rounded-xl bg-primary_green items-center justify-center"
                  >
                     <Text className="font-semibold text-white">
                        {saving ? "Saving..." : isEditing ? "Save changes" : "Create alert"}
                     </Text>
                  </Pressable>
               </View>
            </View>
         </View>
      </Modal>
   );
}
