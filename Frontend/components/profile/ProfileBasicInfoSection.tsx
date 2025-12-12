import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function ProfileBasicInfoSection() {
   const [isEditing, setIsEditing] = useState(false);

   // Mock data - replace with actual user data
   const [userInfo, setUserInfo] = useState({
      firstName: "Sarah",
      lastName: "Mitchell",
      email: "sarah.mitchell@email.com",
      phone: "+01 412 345 678",
      phoneVerified: true,
      postcode: "2000 Sydney CBD",
   });

   return (
      <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-6 shadow-sm">
         <View className="flex-row items-center justify-between mb-5">
            <Text className="text-xl font-bold text-gray-900">
               Basic Information
            </Text>
            <Pressable
               onPress={() => setIsEditing(!isEditing)}
               className="flex-row items-center gap-2"
            >
               <Ionicons
                  name={isEditing ? "close" : "create-outline"}
                  size={20}
                  color={isEditing ? "#EF4444" : "#10B981"}
               />
               <Text
                  className={`text-sm font-semibold ${isEditing ? "text-red-600" : "text-primary_green"
                     }`}
               >
                  {isEditing ? "Cancel" : "Edit"}
               </Text>
            </Pressable>
         </View>

         <View className="gap-4">
            {/* First Name */}
            <View className="gap-2">
               <Text className="text-sm font-semibold text-gray-700">
                  First Name
               </Text>
               {isEditing ? (
                  <TextInput
                     value={userInfo.firstName}
                     onChangeText={(text) =>
                        setUserInfo({ ...userInfo, firstName: text })
                     }
                     className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
                  />
               ) : (
                  <Text className="text-gray-900 text-base py-2">
                     {userInfo.firstName}
                  </Text>
               )}
            </View>

            {/* Last Name */}
            <View className="gap-2">
               <Text className="text-sm font-semibold text-gray-700">
                  Last Name
               </Text>
               {isEditing ? (
                  <TextInput
                     value={userInfo.lastName}
                     onChangeText={(text) =>
                        setUserInfo({ ...userInfo, lastName: text })
                     }
                     className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
                  />
               ) : (
                  <Text className="text-gray-900 text-base py-2">
                     {userInfo.lastName}
                  </Text>
               )}
            </View>

            {/* Email */}
            <View className="gap-2">
               <Text className="text-sm font-semibold text-gray-700">
                  Email Address
               </Text>
               {isEditing ? (
                  <TextInput
                     value={userInfo.email}
                     onChangeText={(text) =>
                        setUserInfo({ ...userInfo, email: text })
                     }
                     keyboardType="email-address"
                     autoCapitalize="none"
                     className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
                  />
               ) : (
                  <Text className="text-gray-900 text-base py-2">
                     {userInfo.email}
                  </Text>
               )}
            </View>

            {/* Phone Number */}
            <View className="gap-2">
               <Text className="text-sm font-semibold text-gray-700">
                  Phone Number
               </Text>
               <View className="flex-row items-center gap-3">
                  {isEditing ? (
                     <TextInput
                        value={userInfo.phone}
                        onChangeText={(text) =>
                           setUserInfo({ ...userInfo, phone: text })
                        }
                        keyboardType="phone-pad"
                        className="flex-1 border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
                     />
                  ) : (
                     <>
                        <Text className="text-gray-900 text-base flex-1">
                           {userInfo.phone}
                        </Text>
                        {userInfo.phoneVerified && (
                           <View className="flex-row items-center gap-1 bg-green-100 px-3 py-1 rounded-lg">
                              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                              <Text className="text-xs text-green-700 font-medium">
                                 Verified
                              </Text>
                           </View>
                        )}
                     </>
                  )}
               </View>
            </View>

            {/* Postcode */}
            <View className="gap-2">
               <Text className="text-sm font-semibold text-gray-700">
                  Postcode
               </Text>
               {isEditing ? (
                  <TextInput
                     value={userInfo.postcode}
                     onChangeText={(text) =>
                        setUserInfo({ ...userInfo, postcode: text })
                     }
                     className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
                  />
               ) : (
                  <Text className="text-gray-900 text-base py-2">
                     {userInfo.postcode}
                  </Text>
               )}
            </View>

            {/* Save Button (when editing) */}
            {isEditing && (
               <Pressable className="bg-primary_green rounded-xl py-3 mt-2">
                  <Text className="text-white font-semibold text-center">
                     Save Changes
                  </Text>
               </Pressable>
            )}
         </View>
      </View>
   );
}
