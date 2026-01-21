import React from "react";
import { View, Text } from "react-native";

export default function InsightStatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View className="flex-1 bg-white border border-gray-200 rounded-2xl p-4">
      <Text className="text-xs text-gray-500 mb-1">{label}</Text>
      <Text className="text-xl font-extrabold text-dark">{value}</Text>
      {!!sub && <Text className="text-xs text-gray-500 mt-1">{sub}</Text>}
    </View>
  );
}
