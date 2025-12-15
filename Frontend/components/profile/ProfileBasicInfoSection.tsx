import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { UserProfile } from "../../types/UserProfile";

type Props = {
   user?: UserProfile | null;
   loading?: boolean;
};

const EMPTY_PROFILE: UserProfile = {
   firstName: "",
   lastName: "",
   email: "",
   phoneNumber: "",
   phoneVerified: false,
   postcode: "",
};

function ProfileBasicInfoSection({ user, loading }: Props): JSX.Element {
   const [isEditing, setIsEditing] = useState(false);
   const [userInfo, setUserInfo] = useState<UserProfile>(EMPTY_PROFILE);

   useEffect(() => {
      if (user) {
         setUserInfo({
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
            email: user.email ?? "",
            phoneNumber: user.phoneNumber ?? "",
            phoneVerified: user.phoneVerified ?? Boolean(user.phoneNumber),
            postcode: user.postcode ?? "",
         });
      }
   }, [user]);

   const info = userInfo || EMPTY_PROFILE;
   const readOnlyValue = (value?: string) =>
      value && value.trim().length > 0 ? value : loading ? "Loading..." : "Not provided";

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
                     value={info.firstName}
                     onChangeText={(text) =>
                        setUserInfo({ ...info, firstName: text })
                     }
                     className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
                  />
               ) : (
                  <Text className="text-gray-900 text-base py-2">
                     {readOnlyValue(info.firstName)}
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
                     value={info.lastName}
                     onChangeText={(text) =>
                        setUserInfo({ ...info, lastName: text })
                     }
                     className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
                  />
               ) : (
                  <Text className="text-gray-900 text-base py-2">
                     {readOnlyValue(info.lastName)}
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
                     value={info.email}
                     onChangeText={(text) =>
                        setUserInfo({ ...info, email: text })
                     }
                     keyboardType="email-address"
                     autoCapitalize="none"
                     className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
                  />
               ) : (
                  <Text className="text-gray-900 text-base py-2">
                     {readOnlyValue(info.email)}
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
                        value={info.phoneNumber}
                        onChangeText={(text) =>
                           setUserInfo({ ...info, phoneNumber: text })
                        }
                        keyboardType="phone-pad"
                        className="flex-1 border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
                     />
                  ) : (
                     <>
                        <Text className="text-gray-900 text-base flex-1">
                           {readOnlyValue(info.phoneNumber)}
                        </Text>
                        {info.phoneVerified && (
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
                     value={info.postcode}
                     onChangeText={(text) =>
                        setUserInfo({ ...info, postcode: text })
                     }
                     className="border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-gray-900"
                  />
               ) : (
                  <Text className="text-gray-900 text-base py-2">
                     {readOnlyValue(info.postcode)}
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

export default ProfileBasicInfoSection;
