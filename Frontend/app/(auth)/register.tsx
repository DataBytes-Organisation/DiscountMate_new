import React, { useState } from "react";
import {
   View,
   Text,
   TextInput,
   Pressable,
   ScrollView,
   Modal,
   ActivityIndicator,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import AuthFooter from "../../components/auth/AuthFooter";
import { useRouter } from "expo-router";
import { API_URL } from "../../constants/Api";

type InputProps = {
   label: string;
   placeholder?: string;
   icon?: string;
   secure?: boolean;
   value?: string;
   onChangeText?: (value: string) => void;
   keyboardType?: "default" | "email-address" | "phone-pad";
};

function Input({
   label,
   placeholder,
   icon,
   secure,
   value,
   onChangeText,
   keyboardType = "default",
}: InputProps) {
   const [isFocused, setIsFocused] = useState(false);

   return (
      <View className="gap-1">
         <Text className="text-sm font-medium text-gray-700">{label}</Text>
         <View
            className={[
               "flex-row items-center gap-2 border-2 rounded-xl px-3 h-12 bg-gray-50",
               isFocused
                  ? "border-primary_green shadow-[0_0_0_3px_rgba(16,185,129,0.25)]"
                  : "border-gray-200",
            ].join(" ")}
         >
            {icon ? (
               <Ionicons name={icon as any} size={20} color="#9CA3AF" />
            ) : null}
            <TextInput
               placeholder={placeholder}
               placeholderTextColor="#9CA3AF"
               secureTextEntry={secure}
               value={value}
               onChangeText={onChangeText}
               keyboardType={keyboardType}
               autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
               className="flex-1 text-gray-900 text-base outline-none"
               onFocus={() => setIsFocused(true)}
               onBlur={() => setIsFocused(false)}
               style={{ outlineStyle: 'none', outlineWidth: 0 }}
            />
         </View>
      </View>
   );
}

type PhoneInputProps = {
   value?: string;
   onChangeText?: (value: string) => void;
};

function PhoneInput({ value, onChangeText }: PhoneInputProps) {
   const [isFocused, setIsFocused] = useState(false);

   return (
      <View
         className={[
            "flex-row items-center gap-2 border-2 rounded-xl px-3 h-12 bg-gray-50",
            isFocused
               ? "border-primary_green shadow-[0_0_0_3px_rgba(16,185,129,0.25)]"
               : "border-gray-200",
         ].join(" ")}
      >
         <Ionicons name="call-outline" size={20} color="#9CA3AF" />
         <Text className="text-gray-900 text-base font-medium">+61</Text>
         <TextInput
            placeholder="••• ••• •••"
            placeholderTextColor="#9CA3AF"
            value={value}
            onChangeText={onChangeText}
            keyboardType="phone-pad"
            className="flex-1 text-gray-900 text-base outline-none"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={{ outlineStyle: 'none', outlineWidth: 0 }}
         />
      </View>
   );
}

type SelectProps = {
   label: string;
   placeholder?: string;
   icon?: string;
   options: { label: string; value: string }[];
   value?: string;
   onValueChange: (value: string) => void;
};

function Select({ label, placeholder, icon, options, value, onValueChange }: SelectProps) {
   const [isOpen, setIsOpen] = useState(false);

   const selectedOption = options.find((opt) => opt.value === value);

   return (
      <View className="gap-1">
         <Text className="text-sm font-medium text-gray-700">{label}</Text>
         <Pressable
            onPress={() => setIsOpen(true)}
            className="flex-row items-center gap-2 border border-gray-200 rounded-xl px-3 h-12 bg-gray-50"
         >
            {icon ? (
               <Ionicons name={icon as any} size={20} color="#9CA3AF" />
            ) : null}
            <Text
               className={`flex-1 text-base ${selectedOption ? "text-gray-900" : "text-gray-400"
                  }`}
            >
               {selectedOption ? selectedOption.label : placeholder}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
         </Pressable>

         <Modal
            visible={isOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setIsOpen(false)}
         >
            <Pressable
               className="flex-1 bg-black/50 justify-end"
               onPress={() => setIsOpen(false)}
            >
               <Pressable
                  className="bg-white rounded-t-3xl max-h-[80%]"
                  onPress={(e) => e.stopPropagation()}
               >
                  <View className="px-4 py-4 border-b border-gray-200">
                     <Text className="text-lg font-semibold text-gray-900">
                        {label}
                     </Text>
                  </View>
                  <ScrollView className="max-h-[400px]">
                     {options.map((option) => (
                        <Pressable
                           key={option.value}
                           onPress={() => {
                              onValueChange(option.value);
                              setIsOpen(false);
                           }}
                           className="px-4 py-4 border-b border-gray-100 flex-row items-center justify-between"
                        >
                           <Text className="text-base text-gray-900">
                              {option.label}
                           </Text>
                           {value === option.value && (
                              <Ionicons
                                 name="checkmark"
                                 size={20}
                                 color="#059669"
                              />
                           )}
                        </Pressable>
                     ))}
                  </ScrollView>
               </Pressable>
            </Pressable>
         </Modal>
      </View>
   );
}

type StatProps = {
   label: string;
   value: string;
};

function StatCard({ label, value }: StatProps) {
   return (
      <View className="flex-1 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
         <Text className="text-xl font-semibold text-emerald-900">
            {value}
         </Text>
         <Text className="mt-1 text-sm text-emerald-800">{label}</Text>
      </View>
   );
}

type FeatureProps = {
   icon: string;
   title: string;
   description: string;
};

function FeatureCard({ icon, title, description }: FeatureProps) {
   return (
      <View className="flex-1 min-w-[140px] rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,118,110,0.04)]">
         <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-50 mb-2">
            <Ionicons name={icon as any} size={20} color="#059669" />
         </View>
         <Text className="text-sm font-semibold text-gray-900">
            {title}
         </Text>
         <Text className="mt-1 text-sm text-gray-500">
            {description}
         </Text>
      </View>
   );
}

type TestimonialProps = {
   name: string;
   role: string;
   quote: string;
};

function TestimonialCard({ name, role, quote }: TestimonialProps) {
   return (
      <View className="flex-1 rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
         <View className="flex-row items-center gap-1 mb-2">
            {Array.from({ length: 5 }).map((_, index) => (
               // eslint-disable-next-line react/no-array-index-key
               <Ionicons key={index} name="star" size={16} color="#F59E0B" />
            ))}
         </View>
         <Text className="text-sm text-gray-700">{quote}</Text>
         <View className="mt-3">
            <Text className="text-sm font-semibold text-gray-900">
               {name}
            </Text>
            <Text className="text-sm text-gray-500">{role}</Text>
         </View>
      </View>
   );
}

type FAQProps = {
   question: string;
   answer: string;
};

function FAQItem({ question, answer }: FAQProps) {
   return (
      <View className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
         <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-sm font-semibold text-gray-900">
               {question}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
         </View>
         <Text className="mt-2 text-sm text-gray-600">{answer}</Text>
      </View>
   );
}

type StepProps = {
   icon: string;
   title: string;
   description: string;
};

function StepCard({ icon, title, description }: StepProps) {
   return (
      <View className="flex-1 rounded-2xl border border-gray-100 bg-white px-4 py-4">
         <View className="mb-3 h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
            <Ionicons name={icon as any} size={20} color="#059669" />
         </View>
         <Text className="text-sm font-semibold text-gray-900">
            {title}
         </Text>
         <Text className="mt-1 text-sm text-gray-600">{description}</Text>
      </View>
   );
}

const stats = [
   { label: "Total savings tracked", value: "$2.4M" },
   { label: "Registered shoppers", value: "45,000+" },
   { label: "Daily price updates", value: "2,847" },
];

const featuresRowOne = [
   {
      icon: "pricetag-outline",
      title: "Save more money",
      description: "Compare prices across major supermarkets in a single view.",
   },
   {
      icon: "time-outline",
      title: "Shop in minutes",
      description: "Skip the spreadsheets and manual comparisons each week.",
   },
   {
      icon: "analytics-outline",
      title: "Smarter lists",
      description: "Build lists that show you the cheapest basket automatically.",
   },
];

const featuresRowTwo = [
   {
      icon: "notifications-outline",
      title: "Price alerts",
      description: "Get notified when your regular items drop in price.",
   },
   {
      icon: "card-outline",
      title: "Budget insights",
      description: "Track how much you really spend across stores.",
   },
   {
      icon: "leaf-outline",
      title: "Waste less",
      description: "Plan multi store trips so you only buy what you use.",
   },
];

const testimonials = [
   {
      name: "Sophie, VIC",
      role: "Weekly family shop",
      quote:
         "DiscountMate turned a stressful weekly task into something I actually feel on top of.",
   },
   {
      name: "Michael, NSW",
      role: "Budget conscious shopper",
      quote:
         "Seeing the total savings in dollars each month keeps me motivated to plan ahead.",
   },
   {
      name: "Priya, QLD",
      role: "Meal prep and bulk buys",
      quote:
         "I finally understand which store is best for which items instead of guessing.",
   },
];

const faqs = [
   {
      question: "Is DiscountMate free to use?",
      answer:
         "Yes. You can create an account and start tracking prices at no cost. Some advanced analytics may be added later, but the core tools stay free.",
   },
   {
      question: "Do I need to connect my banking data?",
      answer:
         "No. DiscountMate focuses on item prices and your shopping lists. You stay in control of what you share.",
   },
   {
      question: "Which stores do you support?",
      answer:
         "We are starting with the major supermarket chains in Australia and will keep expanding as new data sources are integrated.",
   },
   {
      question: "Can I use it on mobile and desktop?",
      answer:
         "Yes. DiscountMate is built to work well on both devices, so you can plan on your laptop and shop from your phone.",
   },
];

const groceryRetailers = [
   { label: "Coles", value: "coles" },
   { label: "Woolworths", value: "woolworths" },
   { label: "ALDI", value: "aldi" },
   { label: "IGA", value: "iga" },
   { label: "Other", value: "other" },
];

export default function RegisterScreen() {
   const [selectedStore, setSelectedStore] = useState<string>("");
   const [firstName, setFirstName] = useState("");
   const [lastName, setLastName] = useState("");
   const [email, setEmail] = useState("");
   const [phoneNumber, setPhoneNumber] = useState("");
   const [password, setPassword] = useState("");
   const [confirmPassword, setConfirmPassword] = useState("");
   const [groceryPattern, setGroceryPattern] = useState<string>("");
   const [allowDataUsage, setAllowDataUsage] = useState(true);
   const [allowMarketingEmails, setAllowMarketingEmails] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const router = useRouter();

   const handleRegister = async () => {
      setError(null);

      if (!firstName || !lastName || !email || !password || !confirmPassword) {
         setError("Please fill in all required fields.");
         return;
      }
      if (password.length < 8) {
         setError("Password must be at least 8 characters.");
         return;
      }
      if (password !== confirmPassword) {
         setError("Passwords do not match.");
         return;
      }

      setIsSubmitting(true);
      try {
         const response = await fetch(`${API_URL}/users/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
               email,
               password,
               verifyPassword: confirmPassword,
               user_fname: firstName,
               user_lname: lastName,
               address: "",
               phone_number: phoneNumber ? `+61${phoneNumber}` : "",
               admin: false,
            }),
         });

         const data = await response.json();

         if (!response.ok) {
            setError(data?.message || "Signup failed. Please try again.");
         } else {
            router.push("/(auth)/login");
         }
      } catch (err) {
         setError("An error occurred. Please try again.");
      } finally {
         setIsSubmitting(false);
      }
   };

   return (
      <ScrollView
         className="flex-1 bg-white"
         contentContainerStyle={{ paddingTop: 40, paddingBottom: 0 }}
      >
         {/* Hero */}
         <View className="items-center mb-6 mt-4 px-2">
            <View className="mb-3 flex-row items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1">
               <View className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
               <Text className="text-xs font-medium text-emerald-700">
                  Create your DiscountMate account in under 2 minutes
               </Text>
            </View>
            <View className="flex-row flex-wrap items-center justify-center gap-2">
               <Text className="text-3xl font-bold text-gray-900">Join</Text>
               <View className="flex-row items-center gap-2">
                  <View className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary_green to-secondary_green items-center justify-center shadow-md">
                     <FontAwesome6 name="tag" size={18} color="#FFFFFF" />
                  </View>
                  <Text className="text-3xl font-extrabold bg-gradient-to-r from-primary_green to-secondary_green bg-clip-text text-transparent">
                     DiscountMate
                  </Text>
               </View>
               <Text className="text-3xl font-bold text-gray-900">Today</Text>
            </View>
            <Text className="mt-2 text-base text-gray-500 text-center leading-6 max-w-[360px]">
               Start tracking personalised weekly savings, price drops, and smarter
               grocery planning across your regular stores.
            </Text>
            <View className="mt-2 flex-row items-center gap-1">
               <Text className="text-sm text-gray-500">
                  Already have an account?
               </Text>
               <Pressable onPress={() => router.push("/(auth)/login")}>
                  <Text className="text-sm font-semibold text-emerald-700">
                     Sign in here
                  </Text>
               </Pressable>
            </View>
         </View>

         <View className="w-full px-2 pb-10 pt-6">
            <View className="w-full max-w-5xl self-center gap-8">
               {/* Main layout: form and value props */}
               <View className="flex-col gap-6 md:flex-row md:items-start">
                  {/* Form card */}
                  <View className="relative flex-1 overflow-hidden rounded-3xl border border-gray-200 bg-gray-50 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
                     <View className="pointer-events-none absolute inset-x-5 top-0 h-1 rounded-b-full bg-gradient-to-r from-emerald-400 via-primary_green to-secondary_green opacity-80" />
                     <View className="mb-4">
                        <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                           Create your account
                        </Text>
                        <Text className="mt-1 text-lg font-semibold text-slate-900">
                           Enter a few details so we can personalise your savings.
                        </Text>
                        <Text className="mt-1 text-sm text-gray-500">
                           You can update or remove your information at any time from
                           your account settings.
                        </Text>
                     </View>

                     {/* Name row */}
                     <View className="mt-1 flex-row gap-3">
                        <View className="flex-1">
                           <Input
                              label="First name"
                              placeholder="Alex"
                              value={firstName}
                              onChangeText={setFirstName}
                           />
                        </View>
                        <View className="flex-1">
                           <Input
                              label="Last name"
                              placeholder="Smith"
                              value={lastName}
                              onChangeText={setLastName}
                           />
                        </View>
                     </View>

                     {/* Contact details */}
                     <View className="mt-4 gap-4">
                        <Input
                           label="Email address"
                           placeholder="you@example.com"
                           icon="mail-outline"
                           keyboardType="email-address"
                           value={email}
                           onChangeText={setEmail}
                        />
                        <View className="gap-1">
                           <Text className="text-sm font-medium text-gray-700">
                              Mobile number
                           </Text>
                           <PhoneInput
                              value={phoneNumber}
                              onChangeText={setPhoneNumber}
                           />
                        </View>
                        <View className="flex-row items-center gap-2">
                           <Ionicons
                              name="shield-checkmark-outline"
                              size={16}
                              color="#059669"
                           />
                           <Text className="flex-1 text-sm text-gray-500">
                              We will only use these details for important account
                              updates and security notices, not marketing spam.
                           </Text>
                        </View>
                     </View>

                     {/* Where do you shop */}
                     <View className="mt-5 gap-3">
                        <Select
                           label="Where do you shop most?"
                           placeholder="Select your main supermarket"
                           icon="basket-outline"
                           options={groceryRetailers}
                           value={selectedStore}
                           onValueChange={setSelectedStore}
                        />

                        <View className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 gap-2">
                           <Text className="text-sm font-medium text-gray-800 mb-1">
                              How would you describe your usual grocery pattern?
                           </Text>

                           <Pressable
                              onPress={() => setGroceryPattern("one-store")}
                              className="flex-row items-start gap-2"
                           >
                              <View
                                 className={[
                                    "mt-[3px] h-4 w-4 items-center justify-center rounded-full border",
                                    groceryPattern === "one-store"
                                       ? "border-emerald-600 bg-emerald-600"
                                       : "border-gray-300 bg-white",
                                 ].join(" ")}
                              >
                                 {groceryPattern === "one-store" && (
                                    <View className="h-2 w-2 rounded-full bg-white" />
                                 )}
                              </View>
                              <Text className="flex-1 text-sm text-gray-700">
                                 I mostly shop at one main store each week.
                              </Text>
                           </Pressable>

                           <Pressable
                              onPress={() => setGroceryPattern("two-stores")}
                              className="flex-row items-start gap-2"
                           >
                              <View
                                 className={[
                                    "mt-[3px] h-4 w-4 items-center justify-center rounded-full border",
                                    groceryPattern === "two-stores"
                                       ? "border-emerald-600 bg-emerald-600"
                                       : "border-gray-300 bg-white",
                                 ].join(" ")}
                              >
                                 {groceryPattern === "two-stores" && (
                                    <View className="h-2 w-2 rounded-full bg-white" />
                                 )}
                              </View>
                              <Text className="flex-1 text-sm text-gray-700">
                                 I usually split my shop across two different stores.
                              </Text>
                           </Pressable>

                           <Pressable
                              onPress={() => setGroceryPattern("varies")}
                              className="flex-row items-start gap-2"
                           >
                              <View
                                 className={[
                                    "mt-[3px] h-4 w-4 items-center justify-center rounded-full border",
                                    groceryPattern === "varies"
                                       ? "border-emerald-600 bg-emerald-600"
                                       : "border-gray-300 bg-white",
                                 ].join(" ")}
                              >
                                 {groceryPattern === "varies" && (
                                    <View className="h-2 w-2 rounded-full bg-white" />
                                 )}
                              </View>
                              <Text className="flex-1 text-sm text-gray-700">
                                 It changes week to week, depending on specials or what is
                                 nearby.
                              </Text>
                           </Pressable>
                        </View>
                     </View>

                     {/* Password */}
                     <View className="mt-5 gap-2">
                        <Input
                           label="Create password"
                           placeholder="Choose a strong password"
                           secure
                           icon="lock-closed-outline"
                           value={password}
                           onChangeText={setPassword}
                        />
                        <Input
                           label="Confirm password"
                           placeholder="Re-enter your password"
                           secure
                           icon="lock-closed-outline"
                           value={confirmPassword}
                           onChangeText={setConfirmPassword}
                        />
                        <Text className="text-sm text-gray-500">
                           Use at least 8 characters with a mix of letters and numbers.
                        </Text>
                     </View>

                     {/* Checkboxes + terms */}
                     <View className="mt-5 gap-2">
                        <Pressable
                           onPress={() => setAllowDataUsage(!allowDataUsage)}
                           className="flex-row items-start gap-2"
                        >
                           <View
                              className={[
                                 "mt-[2px] h-5 w-5 items-center justify-center rounded-[6px]",
                                 allowDataUsage
                                    ? "bg-emerald-600"
                                    : "border border-gray-300 bg-white",
                              ].join(" ")}
                           >
                              {allowDataUsage && (
                                 <Ionicons name="checkmark" size={14} color="#ECFDF3" />
                              )}
                           </View>
                           <Text className="flex-1 text-sm text-gray-600">
                              I am happy for DiscountMate to use anonymous usage data to
                              improve pricing accuracy and product coverage.
                           </Text>
                        </Pressable>

                        <Pressable
                           onPress={() => setAllowMarketingEmails(!allowMarketingEmails)}
                           className="flex-row items-start gap-2"
                        >
                           <View
                              className={[
                                 "mt-[2px] h-5 w-5 items-center justify-center rounded-[6px]",
                                 allowMarketingEmails
                                    ? "bg-emerald-600"
                                    : "border border-gray-300 bg-white",
                              ].join(" ")}
                           >
                              {allowMarketingEmails && (
                                 <Ionicons name="checkmark" size={14} color="#ECFDF3" />
                              )}
                           </View>
                           <Text className="flex-1 text-sm text-gray-600">
                              Email me about new features, experiments, and early access
                              tools that could help me save more.
                           </Text>
                        </Pressable>

                        <Text className="mt-1 text-xs text-gray-400">
                           By continuing, you agree to the DiscountMate Terms of Use and
                           acknowledge the Privacy Policy.
                        </Text>
                     </View>

                     {/* Actions */}
                     <View className="mt-6 gap-3">
                        {error ? (
                           <Text className="text-sm text-red-500">{error}</Text>
                        ) : null}
                        <Pressable
                           className="h-12 items-center justify-center rounded-2xl bg-emerald-600"
                           onPress={handleRegister}
                           disabled={isSubmitting}
                        >
                           {isSubmitting ? (
                              <ActivityIndicator color="#fff" />
                           ) : (
                              <Text className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                                 Create free account
                              </Text>
                           )}
                        </Pressable>

                        <View className="flex-row items-center justify-center gap-1">
                           <Text className="text-sm text-gray-500">
                              Already using DiscountMate?
                           </Text>
                           <Pressable onPress={() => router.push("/(auth)/login")}>
                              <Text className="text-sm font-semibold text-emerald-700">
                                 Sign in instead
                              </Text>
                           </Pressable>
                        </View>
                     </View>
                  </View>

                  {/* Why join + stats */}
                  <View className="flex-1 gap-5">
                     <View className="gap-2">
                        <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                           Why join DiscountMate?
                        </Text>
                        <Text className="text-lg font-semibold text-slate-900">
                           Practical tools that turn price watching into real savings.
                        </Text>
                        <Text className="text-sm text-gray-600">
                           DiscountMate is for people who want the truth about which
                           store is cheapest for their actual basket, not for the
                           marketing flyers.
                        </Text>
                     </View>

                     <View className="gap-3">
                        <View className="flex-row flex-wrap gap-3">
                           {featuresRowOne.map((feature) => (
                              <FeatureCard
                                 key={feature.title}
                                 icon={feature.icon}
                                 title={feature.title}
                                 description={feature.description}
                              />
                           ))}
                        </View>
                        <View className="flex-row flex-wrap gap-3">
                           {featuresRowTwo.map((feature) => (
                              <FeatureCard
                                 key={feature.title}
                                 icon={feature.icon}
                                 title={feature.title}
                                 description={feature.description}
                              />
                           ))}
                        </View>
                     </View>

                     <View className="mt-2 flex-row flex-wrap gap-3">
                        {stats.map((item) => (
                           <StatCard
                              key={item.label}
                              label={item.label}
                              value={item.value}
                           />
                        ))}
                     </View>

                     {/* Price tracking + tools */}
                     <View className="mt-4 gap-3">
                        <View className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-6">
                           <View className="mb-3 flex-row items-center gap-3">
                              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-white">
                                 <Ionicons
                                    name="trending-down-outline"
                                    size={20}
                                    color="#059669"
                                 />
                              </View>
                              <Text className="text-lg font-semibold text-emerald-900">
                                 Real time price tracking
                              </Text>
                           </View>
                           <Text className="mt-2 text-sm text-emerald-800">
                              DiscountMate watches prices for your regular items, flags
                              cheaper swaps from other stores, and keeps all of that
                              context in one place so you do not have to.
                           </Text>
                           <View className="mt-4 gap-2">
                              <View className="flex-row items-center gap-2">
                                 <Ionicons
                                    name="checkmark-circle"
                                    size={18}
                                    color="#047857"
                                 />
                                 <Text className="text-sm text-emerald-900">
                                    Track price history for products you care about.
                                 </Text>
                              </View>
                              <View className="flex-row items-center gap-2">
                                 <Ionicons
                                    name="checkmark-circle"
                                    size={18}
                                    color="#047857"
                                 />
                                 <Text className="text-sm text-emerald-900">
                                    Catch promotions and specials without chasing every
                                    flyer.
                                 </Text>
                              </View>
                              <View className="flex-row items-center gap-2">
                                 <Ionicons
                                    name="checkmark-circle"
                                    size={18}
                                    color="#047857"
                                 />
                                 <Text className="text-sm text-emerald-900">
                                    See your potential savings before you head to the
                                    store.
                                 </Text>
                              </View>
                           </View>
                        </View>

                        <View className="rounded-2xl border border-gray-100 bg-white px-4 py-4">
                           <Text className="text-sm font-semibold text-gray-900">
                              Smart shopping tools
                           </Text>
                           <Text className="mt-1 text-sm text-gray-600">
                              Build multiple lists, compare baskets store by store, and
                              share plans with your partner or housemates.
                           </Text>
                           <View className="mt-3 gap-2">
                              <View className="flex-row items-center gap-2">
                                 <View className="h-5 w-5 items-center justify-center rounded-[6px] bg-emerald-600">
                                    <Ionicons name="checkmark" size={14} color="#ECFDF3" />
                                 </View>
                                 <Text className="text-sm text-gray-700">
                                    Create lists for weekly shops, specials runs, or bulk
                                    buys.
                                 </Text>
                              </View>
                              <View className="flex-row items-center gap-2">
                                 <View className="h-5 w-5 items-center justify-center rounded-[6px] bg-emerald-600">
                                    <Ionicons name="checkmark" size={14} color="#ECFDF3" />
                                 </View>
                                 <Text className="text-sm text-gray-700">
                                    Compare the same basket across different retailers.
                                 </Text>
                              </View>
                              <View className="flex-row items-center gap-2">
                                 <View className="h-5 w-5 items-center justify-center rounded-[6px] bg-emerald-600">
                                    <Ionicons name="checkmark" size={14} color="#ECFDF3" />
                                 </View>
                                 <Text className="text-sm text-gray-700">
                                    Export or share your list so others can help with the
                                    shop.
                                 </Text>
                              </View>
                           </View>
                        </View>

                        <View className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-4">
                           <Text className="text-sm font-semibold text-emerald-900">
                              Built for everyday shoppers, not data analysts
                           </Text>
                           <Text className="mt-1 text-sm text-emerald-800">
                              Under the hood, DiscountMate runs serious analytics. On the
                              surface, you get clear answers that fit on a single screen.
                           </Text>
                        </View>
                     </View>
                  </View>
               </View>

               {/* Testimonials */}
               <View className="mt-10 gap-3">
                  <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                     What our users say
                  </Text>
                  <Text className="text-lg font-semibold text-slate-900">
                     Small shifts in planning can add up to thousands each year.
                  </Text>
                  <View className="mt-4 flex-col gap-3 md:flex-row">
                     {testimonials.map((item) => (
                        <TestimonialCard
                           key={item.name}
                           name={item.name}
                           role={item.role}
                           quote={item.quote}
                        />
                     ))}
                  </View>
               </View>

               {/* How it works */}
               <View className="mt-10 gap-3">
                  <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                     How it works
                  </Text>
                  <Text className="text-lg font-semibold text-slate-900">
                     Three simple steps to start saving.
                  </Text>
                  <View className="mt-4 flex-col gap-3 md:flex-row">
                     <StepCard
                        icon="person-add-outline"
                        title="Create your account"
                        description="Tell us a little about how you shop so we can start with realistic assumptions, not generic averages."
                     />
                     <StepCard
                        icon="list-outline"
                        title="Add your first list"
                        description="Search for the items you buy most often and drop them into a list that matches your next shop."
                     />
                     <StepCard
                        icon="wallet-outline"
                        title="Compare and save"
                        description="See which store wins for your basket, then adjust a few items to unlock even more savings."
                     />
                  </View>
               </View>

               {/* FAQ */}
               <View className="mt-10 gap-3">
                  <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
                     Frequently asked questions
                  </Text>
                  <Text className="text-lg font-semibold text-slate-900">
                     Answers to common questions before you sign up.
                  </Text>
                  <View className="mt-4 gap-3">
                     {faqs.map((item) => (
                        <FAQItem
                           key={item.question}
                           question={item.question}
                           answer={item.answer}
                        />
                     ))}
                  </View>
               </View>

               {/* Final call to action */}
               <View className="mt-10 rounded-3xl bg-slate-900 px-5 py-7">
                  <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
                     Ready to start saving?
                  </Text>
                  <Text className="mt-2 text-lg font-semibold text-white">
                     Join thousands of shoppers who refuse to pay more than they need
                     to.
                  </Text>
                  <Text className="mt-2 text-sm text-slate-300">
                     Create your account in under two minutes. No card details
                     required, no long onboarding, just the tools you need to plan a
                     smarter shop.
                  </Text>

                  <View className="mt-4 flex-row flex-wrap items-center gap-3">
                     <Pressable
                        className="h-12 items-center justify-center rounded-2xl bg-emerald-500 px-5"
                        onPress={handleRegister}
                        disabled={isSubmitting}
                     >
                        <Text className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                           Create free account
                        </Text>
                     </Pressable>
                     <Pressable className="h-12 items-center justify-center rounded-2xl border border-slate-500 px-5">
                        <Text className="text-sm font-semibold text-slate-100">
                           Explore how it works
                        </Text>
                     </Pressable>
                  </View>

                  <View className="mt-4 flex-row flex-wrap gap-3">
                     <View className="flex-row items-center gap-2">
                        <Ionicons
                           name="shield-checkmark-outline"
                           size={16}
                           color="#A5B4FC"
                        />
                        <Text className="text-xs text-slate-300">
                           Built with privacy and transparency in mind.
                        </Text>
                     </View>
                     <View className="flex-row items-center gap-2">
                        <Ionicons name="sparkles-outline" size={16} color="#A5B4FC" />
                        <Text className="text-xs text-slate-300">
                           Designed for real households, not idealised budgets.
                        </Text>
                     </View>
                  </View>
               </View>
            </View>
         </View>
         <AuthFooter />
      </ScrollView>
   );
}
