import React, { useMemo } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { FontAwesome } from "@expo/vector-icons";

export default function ExportShareSection() {
   const shareUrl = useMemo(() => "https://discountmate.com/compare/abc123", []);

   const exportOptions = [
      {
         id: "pdf",
         icon: "file-pdf" as const,
         label: "Export to PDF",
         description: "Download printable comparison",
         iconColor: "#EF4444",
         softBg: "bg-red-100",
      },
      {
         id: "excel",
         icon: "file-excel" as const,
         label: "Export to Excel",
         description: "Analyze data in spreadsheet",
         iconColor: "#10B981",
         softBg: "bg-green-100",
      },
      {
         id: "email",
         icon: "envelope" as const,
         label: "Email Report",
         description: "Send to yourself or others",
         iconColor: "#2563EB",
         softBg: "bg-blue-100",
      },
   ];

   return (
      <View className="px-4 md:px-8 py-10 bg-[#F9FAFB]">
         <View className="w-full">
            {/* Header */}
            <View className="mb-8">
               <Text className="text-3xl font-bold text-gray-900 mb-2">Export & Share</Text>
               <Text className="text-base text-gray-600">Save and share your comparison data</Text>
            </View>

            {/* Outer card */}
            <View className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
               <View className="p-8">
                  {/* Export tiles */}
                  <View className="flex-row flex-wrap gap-6">
                     {exportOptions.map((opt) => (
                        <Pressable
                           key={opt.id}
                           className="flex-1 min-w-[240px] bg-gray-50/40 rounded-2xl border border-gray-200 shadow-sm px-6 py-8 items-center"
                        >
                           <View className={["w-16 h-16 rounded-2xl items-center justify-center shadow-sm", opt.softBg].join(" ")}>
                              <FontAwesome6 name={opt.icon} size={26} color={opt.iconColor} />
                           </View>

                           <Text className="mt-4 text-base font-bold text-gray-900">{opt.label}</Text>
                           <Text className="mt-1 text-sm text-gray-600">{opt.description}</Text>
                        </Pressable>
                     ))}
                  </View>

                  {/* Divider */}
                  <View className="h-px bg-gray-200 my-8" />

                  {/* Share with Friends */}
                  <Text className="text-lg font-bold text-gray-900 mb-4">Share with Friends</Text>

                  <View className="flex-row items-center gap-4">
                     <View className="flex-1">
                        <TextInput
                           value={shareUrl}
                           editable={false}
                           className="w-full px-5 py-4 rounded-2xl bg-white border border-gray-200 text-gray-700"
                        />
                     </View>

                     <Pressable className="px-6 py-4 rounded-2xl bg-primary_green shadow-sm">
                        <View className="flex-row items-center gap-2">
                           <FontAwesome6 name="copy" size={16} color="#FFFFFF" />
                           <Text className="text-white font-semibold">Copy Link</Text>
                        </View>
                     </Pressable>
                  </View>

                  {/* Share via */}
                  <View className="mt-6 flex-row items-center gap-4">
                     <Text className="text-sm font-semibold text-gray-600">Share via:</Text>

                     <Pressable className="w-12 h-12 rounded-2xl bg-blue-600 items-center justify-center shadow-sm">
                        <FontAwesome name="facebook" size={20} color="#FFFFFF" />
                     </Pressable>

                     <Pressable className="w-12 h-12 rounded-2xl bg-sky-500 items-center justify-center shadow-sm">
                        <FontAwesome name="twitter" size={20} color="#FFFFFF" />
                     </Pressable>

                     <Pressable className="w-12 h-12 rounded-2xl bg-green-500 items-center justify-center shadow-sm">
                        <FontAwesome name="whatsapp" size={20} color="#FFFFFF" />
                     </Pressable>

                     <Pressable className="w-12 h-12 rounded-2xl bg-gray-800 items-center justify-center shadow-sm">
                        <FontAwesome name="envelope" size={20} color="#FFFFFF" />
                     </Pressable>
                  </View>
               </View>
            </View>
         </View>
      </View>
   );
}
