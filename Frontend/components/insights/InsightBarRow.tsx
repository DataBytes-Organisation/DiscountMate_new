import React from "react";
import { View, Text } from "react-native";

export default function InsightBarRow({
  title,
  rightText,
  pct,
}: {
  title: string;
  rightText: string;
  pct: number;
}) {
  const safe = Math.max(0, Math.min(100, pct));

  return (
    <View className="bg-white border border-gray-200 rounded-2xl p-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-bold text-dark">{title}</Text>
        <Text className="text-gray-600">{rightText}</Text>
      </View>

      <View className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
        <View
          className="h-3 rounded-full bg-primary_green"
          style={{ width: `${safe}%` }}
        />
      </View>
    </View>
  );
}
