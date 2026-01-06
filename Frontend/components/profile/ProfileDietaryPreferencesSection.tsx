import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function ProfileDietaryPreferencesSection() {
   // Mock data - replace with actual dietary preferences
   const [preferences, setPreferences] = useState<string[]>([]);

   const dietaryOptions = [
      "Vegetarian",
      "Vegan",
      "Dairy-Free",
      "Nut-Free",
      "Kosher",
      "Organic",
      "Gluten-Free",
      "Halal",
      "Low Sugar",
   ];

   const togglePreference = (option: string) => {
      setPreferences((prev) =>
         prev.includes(option)
            ? prev.filter((p) => p !== option)
            : [...prev, option]
      );
   };

   return (
      <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-6 shadow-sm">
         <View className="mb-5">
            <Text className="text-xl font-bold text-gray-900 mb-2">
               Dietary Preferences & Restrictions
            </Text>
            <Text className="text-sm text-gray-600">
               Help us personalize your shopping experience by setting your dietary
               needs
            </Text>
         </View>

         <View className="flex-row flex-wrap gap-3">
            {dietaryOptions.map((option) => {
               const isSelected = preferences.includes(option);
               return (
                  <Pressable
                     key={option}
                     onPress={() => togglePreference(option)}
                     className={`px-4 py-2.5 rounded-xl border-2 flex-row items-center gap-2 ${isSelected
                           ? "bg-emerald-50 border-primary_green"
                           : "bg-gray-50 border-gray-200"
                        }`}
                  >
                     {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                     )}
                     <Text
                        className={`text-sm font-medium ${isSelected ? "text-primary_green" : "text-gray-700"
                           }`}
                     >
                        {option}
                     </Text>
                  </Pressable>
               );
            })}
         </View>

         <Pressable className="bg-primary_green rounded-xl py-3 mt-6 self-end px-6">
            <Text className="text-white font-semibold">Save Preferences</Text>
         </Pressable>
      </View>
   );
}
