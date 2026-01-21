import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export default function InsightsIndex() {
  const router = useRouter();

  const Card = ({
    title,
    desc,
    icon,
    href,
  }: {
    title: string;
    desc: string;
    icon: React.ComponentProps<typeof FontAwesome6>["name"];
    href: string;
  }) => (
    <Pressable
      className="bg-white border border-gray-200 rounded-2xl p-5"
      onPress={() => router.push(href)}
    >
      <View className="flex-row items-center gap-3">
        <FontAwesome6 name={icon} size={18} color="#4B5563" />
        <Text className="text-base font-extrabold text-dark">{title}</Text>
      </View>
      <Text className="text-gray-600 mt-2">{desc}</Text>
    </Pressable>
  );

  return (
    <ScrollView className="flex-1 bg-[#F9FAFB]" contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text className="text-2xl font-extrabold text-dark">Insights</Text>
      <Text className="text-gray-600 mb-2">
        Built from your product retailer prices (price + originalPrice).
      </Text>

      <Card
        title="Savings Overview"
        desc="Total saved, average discount, top savers"
        icon="piggy-bank"
        href="/insights/savings"
      />
      <Card
        title="Category Trends"
        desc="Which categories give the biggest average discount"
        icon="layer-group"
        href="/insights/categories"
      />
      <Card
        title="Retailer Performance"
        desc="Compare retailers by average discount and cheapest win-rate"
        icon="store"
        href="/insights/retailers"
      />
    </ScrollView>
  );
}
