import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export default function ProfileShoppingHistorySection() {
   const [currentPage, setCurrentPage] = useState(1);
   const itemsPerPage = 5;

   // Mock data - replace with actual shopping history
   const shoppingHistory = [
      {
         date: "Jan 25, 2025",
         store: "Woolworths",
         items: 12,
         totalSpent: 87.50,
         amountSaved: 12.30,
      },
      {
         date: "Jan 20, 2025",
         store: "Coles",
         items: 8,
         totalSpent: 65.20,
         amountSaved: 8.90,
      },
      {
         date: "Jan 15, 2025",
         store: "Aldi",
         items: 15,
         totalSpent: 92.40,
         amountSaved: 15.60,
      },
      {
         date: "Jan 10, 2025",
         store: "Woolworths",
         items: 10,
         totalSpent: 78.30,
         amountSaved: 10.20,
      },
      {
         date: "Jan 5, 2025",
         store: "Coles",
         items: 6,
         totalSpent: 45.60,
         amountSaved: 6.40,
      },
      {
         date: "Dec 30, 2024",
         store: "Woolworths",
         items: 14,
         totalSpent: 105.80,
         amountSaved: 18.50,
      },
      {
         date: "Dec 25, 2024",
         store: "Aldi",
         items: 9,
         totalSpent: 68.90,
         amountSaved: 9.80,
      },
   ];

   const totalPages = Math.ceil(shoppingHistory.length / itemsPerPage);
   const startIndex = (currentPage - 1) * itemsPerPage;
   const endIndex = startIndex + itemsPerPage;
   const currentItems = shoppingHistory.slice(startIndex, endIndex);

   return (
      <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-6 shadow-sm">
         <View className="mb-5">
            <Text className="text-xl font-bold text-gray-900 mb-2">
               Shopping History
            </Text>
            <Text className="text-sm text-gray-600">
               Review your past shopping trips and savings
            </Text>
         </View>

         {/* Table Header */}
         <View className="flex-row items-center gap-3 pb-3 border-b-2 border-gray-200 mb-3">
            <View className="flex-1">
               <Text className="text-xs font-semibold text-gray-500 uppercase">
                  Date
               </Text>
            </View>
            <View className="flex-1">
               <Text className="text-xs font-semibold text-gray-500 uppercase">
                  Store
               </Text>
            </View>
            <View className="w-16">
               <Text className="text-xs font-semibold text-gray-500 uppercase">
                  Items
               </Text>
            </View>
            <View className="w-24">
               <Text className="text-xs font-semibold text-gray-500 uppercase">
                  Total
               </Text>
            </View>
            <View className="w-24">
               <Text className="text-xs font-semibold text-gray-500 uppercase">
                  Saved
               </Text>
            </View>
            <View className="w-20">
               <Text className="text-xs font-semibold text-gray-500 uppercase">
                  Actions
               </Text>
            </View>
         </View>

         {/* Table Rows */}
         <View className="gap-2">
            {currentItems.map((trip, index) => (
               <View
                  key={index}
                  className="flex-row items-center gap-3 py-3 border-b border-gray-100 last:border-0"
               >
                  <View className="flex-1">
                     <Text className="text-sm text-gray-900">{trip.date}</Text>
                  </View>
                  <View className="flex-1">
                     <View className="flex-row items-center gap-2">
                        <FontAwesome6 name="store" size={14} color="#6B7280" />
                        <Text className="text-sm text-gray-900">{trip.store}</Text>
                     </View>
                  </View>
                  <View className="w-16">
                     <Text className="text-sm text-gray-700">{trip.items}</Text>
                  </View>
                  <View className="w-24">
                     <Text className="text-sm font-semibold text-gray-900">
                        ${trip.totalSpent.toFixed(2)}
                     </Text>
                  </View>
                  <View className="w-24">
                     <Text className="text-sm font-semibold text-primary_green">
                        ${trip.amountSaved.toFixed(2)}
                     </Text>
                  </View>
                  <View className="w-20">
                     <Pressable>
                        <Text className="text-sm font-semibold text-primary_green">
                           View Details
                        </Text>
                     </Pressable>
                  </View>
               </View>
            ))}
         </View>

         {/* Pagination */}
         {totalPages > 1 && (
            <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-gray-200">
               <Pressable
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-lg ${currentPage === 1
                        ? "bg-gray-100"
                        : "bg-gray-200 active:bg-gray-300"
                     }`}
               >
                  <Text
                     className={`text-sm font-medium ${currentPage === 1 ? "text-gray-400" : "text-gray-700"
                        }`}
                  >
                     Previous
                  </Text>
               </Pressable>

               <Text className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
               </Text>

               <Pressable
                  onPress={() =>
                     setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 rounded-lg ${currentPage === totalPages
                        ? "bg-gray-100"
                        : "bg-gray-200 active:bg-gray-300"
                     }`}
               >
                  <Text
                     className={`text-sm font-medium ${currentPage === totalPages
                           ? "text-gray-400"
                           : "text-gray-700"
                        }`}
                  >
                     Next
                  </Text>
               </Pressable>
            </View>
         )}
      </View>
   );
}
