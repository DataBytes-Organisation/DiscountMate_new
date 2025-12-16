import React, { useState } from "react";
import {
   View,
   Text,
   TextInput,
   Pressable,
   ScrollView,
   ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "react-native-vector-icons/Ionicons";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../../constants/Api";

export default function LoginPage() {
   const router = useRouter();
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const [rememberMe, setRememberMe] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [isEmailFocused, setIsEmailFocused] = useState(false);
   const [isPasswordFocused, setIsPasswordFocused] = useState(false);

   const handleLogin = async () => {
      setError(null);
      if (!email || !password) {
         setError("Please enter both email and password.");
         return;
      }
      setIsSubmitting(true);
      try {
         const response = await fetch(`${API_URL}/users/signin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
         });

         const data = await response.json();

         if (!response.ok) {
            const details =
               typeof data === "string"
                  ? data
                  : data?.message || JSON.stringify(data || {});
            setError(`Login failed: ${details}`);
         } else {
            if (data?.token) {
               await AsyncStorage.setItem("authToken", data.token);
            }
            router.push("/(tabs)");
         }
      } catch (err) {
         setError("Unable to reach the server. Please try again.");
      } finally {
         setIsSubmitting(false);
      }
   };

   return (
      <View className="flex-1 bg-[#f7fbfa] relative">
         {/* Soft background glows */}
         <View className="absolute -left-24 top-10 w-80 h-80 bg-primary_green/15 rounded-full" />
         <View className="absolute -right-20 bottom-12 w-72 h-72 bg-secondary_green/15 rounded-full" />

         <ScrollView
            contentContainerStyle={{
               paddingHorizontal: 16,
               paddingVertical: 32,
               flexGrow: 1,
               justifyContent: "center",
            }}
            showsVerticalScrollIndicator={false}
         >
            <View className="w-full max-w-[520px] self-center bg-white rounded-3xl border border-gray-100 px-6 py-8 shadow-2xl">
               {/* Brand badge */}
               <View className="items-center">
                  <View className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary_green to-secondary_green items-center justify-center shadow-lg">
                     <FontAwesome6 name="tag" size={22} color="#FFFFFF" />
                  </View>

                  <View className="mt-4 items-center">
                     <Text className="text-2xl font-bold text-gray-900">
                        Welcome to DiscountMate
                     </Text>
                     <Text className="text-sm text-gray-500 mt-2 leading-5 text-center">
                        Sign in to continue comparing prices and maximizing your
                        savings
                     </Text>
                  </View>
               </View>

               {/* Form */}
               <View className="mt-8 gap-4">
                  <View className="gap-2">
                     <Text className="text-sm font-semibold text-gray-800">
                        Email Address
                     </Text>
                     <View
                        className={[
                           "flex-row items-center gap-3 border-2 rounded-xl px-3 h-12 bg-gray-50",
                           isEmailFocused
                              ? "border-primary_green shadow-[0_0_0_3px_rgba(16,185,129,0.25)]"
                              : "border-gray-200",
                        ].join(" ")}
                     >
                        <Ionicons name="mail-outline" size={18} color="#9CA3AF" />
                        <TextInput
                           value={email}
                           onChangeText={setEmail}
                           placeholder="Enter your email"
                           placeholderTextColor="#9CA3AF"
                           autoCapitalize="none"
                           keyboardType="email-address"
                           className="flex-1 text-gray-900 outline-none"
                           onFocus={() => setIsEmailFocused(true)}
                           onBlur={() => setIsEmailFocused(false)}
                           style={{ outlineStyle: 'none', outlineWidth: 0 }}
                        />
                     </View>
                  </View>

                  <View className="gap-2">
                     <Text className="text-sm font-semibold text-gray-800">
                        Password
                     </Text>
                     <View
                        className={[
                           "flex-row items-center gap-3 border-2 rounded-xl px-3 h-12 bg-gray-50",
                           isPasswordFocused
                              ? "border-primary_green shadow-[0_0_0_3px_rgba(16,185,129,0.25)]"
                              : "border-gray-200",
                        ].join(" ")}
                     >
                        <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" />
                        <TextInput
                           value={password}
                           onChangeText={setPassword}
                           placeholder="Enter your password"
                           placeholderTextColor="#9CA3AF"
                           secureTextEntry
                           className="flex-1 text-gray-900 outline-none"
                           onFocus={() => setIsPasswordFocused(true)}
                           onBlur={() => setIsPasswordFocused(false)}
                           style={{ outlineStyle: 'none', outlineWidth: 0 }}
                        />
                     </View>
                  </View>

                  <View className="flex-row items-center justify-between mt-1">
                     <Pressable
                        onPress={() => setRememberMe(!rememberMe)}
                        className="flex-row items-center gap-2"
                     >
                        <View
                           className={[
                              "w-5 h-5 rounded-md border",
                              rememberMe
                                 ? "bg-primary_green border-primary_green"
                                 : "border-gray-300",
                           ].join(" ")}
                        >
                           {rememberMe && (
                              <Ionicons
                                 name="checkmark"
                                 size={14}
                                 color="#FFFFFF"
                                 style={{ textAlign: "center", marginTop: 1 }}
                              />
                           )}
                        </View>
                        <Text className="text-sm text-gray-700">Remember me</Text>
                     </Pressable>

                     <Pressable>
                        <Text className="text-sm font-semibold text-primary_green">
                           Forgot password?
                        </Text>
                     </Pressable>
                  </View>

                  {error ? (
                     <Text className="text-sm text-red-500">{error}</Text>
                  ) : null}
                  <Pressable
                     className={`mt-2 bg-primary_green rounded-xl h-12 items-center justify-center shadow-md shadow-primary_green/30 ${isSubmitting ? "opacity-80" : ""
                        }`}
                     onPress={handleLogin}
                     disabled={isSubmitting}
                  >
                     {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                     ) : (
                        <Text className="text-base font-semibold text-white">
                           Sign In
                        </Text>
                     )}
                  </Pressable>

                  <View className="flex-row items-center gap-3 mt-6">
                     <View className="flex-1 h-px bg-gray-200" />
                     <Text className="text-sm text-gray-500">
                        Or continue with
                     </Text>
                     <View className="flex-1 h-px bg-gray-200" />
                  </View>

                  <View className="flex-row gap-3 mt-2">
                     <Pressable className="flex-1 flex-row items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 bg-white">
                        <FontAwesome6 name="google" size={18} color="#DB4437" />
                        <Text className="text-sm font-semibold text-gray-800">
                           Google
                        </Text>
                     </Pressable>
                     <Pressable className="flex-1 flex-row items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 bg-white">
                        <FontAwesome6 name="facebook" size={18} color="#1877F2" />
                        <Text className="text-sm font-semibold text-gray-800">
                           Facebook
                        </Text>
                     </Pressable>
                  </View>

                  <View className="flex-row justify-center items-center mt-6">
                     <Text className="text-sm text-gray-600">
                        Don&apos;t have an account?
                     </Text>
                     <Pressable onPress={() => router.push("/(auth)/register")}>
                        <Text className="text-sm font-semibold text-primary_green ml-1">
                           Create account
                        </Text>
                     </Pressable>
                  </View>
               </View>
            </View>
         </ScrollView>
      </View>
   );
}

