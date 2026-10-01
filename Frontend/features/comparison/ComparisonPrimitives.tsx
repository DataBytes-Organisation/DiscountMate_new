import React, { type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import type { ComparisonWarning } from "../../types/Comparison";
import { warningMessage } from "./presentation";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
   return (
      <View className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
         {children}
      </View>
   );
}

export function ActionButton({
   label,
   onPress,
   icon,
   primary = false,
   disabled = false,
   compact = false,
}: {
   label: string;
   onPress?: () => void;
   icon?: string;
   primary?: boolean;
   disabled?: boolean;
   compact?: boolean;
}) {
   return (
      <Pressable
         accessibilityRole="button"
         accessibilityLabel={label}
         disabled={disabled}
         onPress={onPress}
         className={`${compact ? "px-3 py-2" : "px-4 py-3"} flex-row items-center justify-center gap-2 rounded-lg border ${
            primary ? "border-primary_green bg-primary_green" : "border-gray-200 bg-white"
         } ${disabled ? "opacity-45" : ""}`}
      >
         {icon ? <FontAwesome6 name={icon} size={13} color={primary ? "#FFFFFF" : "#0DAD79"} /> : null}
         <Text className={`text-sm font-semibold ${primary ? "text-white" : "text-gray-700"}`}>{label}</Text>
      </Pressable>
   );
}

export function WarningBanner({ warning }: { warning: ComparisonWarning }) {
   return (
      <View
         accessibilityRole="alert"
         className="mb-3 flex-row items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
      >
         <FontAwesome6 name="triangle-exclamation" size={14} color="#B45309" />
         <Text className="flex-1 text-sm text-amber-900">{warningMessage(warning)}</Text>
      </View>
   );
}

export function LoadingState({ label = "Loading comparison…" }: { label?: string }) {
   return (
      <Card className="items-center px-6 py-14">
         <ActivityIndicator size="large" color="#0DAD79" />
         <Text className="mt-4 text-sm text-gray-600">{label}</Text>
         <View className="mt-6 h-3 w-full max-w-lg rounded-full bg-gray-100" />
         <View className="mt-3 h-3 w-4/5 max-w-md rounded-full bg-gray-100" />
      </Card>
   );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
   return (
      <Card className="items-center px-6 py-12">
         <View className="h-11 w-11 items-center justify-center rounded-full bg-red-50">
            <FontAwesome6 name="rotate" size={17} color="#DC2626" />
         </View>
         <Text className="mt-4 text-center text-base font-semibold text-gray-900">Comparison unavailable</Text>
         <Text className="mt-2 max-w-lg text-center text-sm text-gray-600">{message}</Text>
         <View className="mt-5"><ActionButton label="Retry" onPress={onRetry} primary /></View>
      </Card>
   );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
   return (
      <Card className="items-center px-6 py-14">
         <View className="h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
            <FontAwesome6 name="magnifying-glass" size={18} color="#0DAD79" />
         </View>
         <Text className="mt-4 text-center text-lg font-bold text-gray-900">{title}</Text>
         <Text className="mt-2 max-w-xl text-center text-sm leading-5 text-gray-500">{body}</Text>
      </Card>
   );
}

export function SectionHeader({ title, subtitle, trailing }: {
   title: string;
   subtitle?: string;
   trailing?: ReactNode;
}) {
   return (
      <View className="flex-row items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
         <View className="flex-1">
            <Text className="text-base font-bold text-gray-900">{title}</Text>
            {subtitle ? <Text className="mt-1 text-xs text-gray-500">{subtitle}</Text> : null}
         </View>
         {trailing}
      </View>
   );
}
