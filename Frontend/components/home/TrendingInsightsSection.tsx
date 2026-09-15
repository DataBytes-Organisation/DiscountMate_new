import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { API_URL } from "@/constants/Api";

interface TrendingCategory {
  category: string;
  avg_price_drop_pct: number | null;
  avg_savings: number | null;
  trend_label: string;
  description: string;
  icon: string;
}

interface TrendingResponse {
  success: boolean;
  data: TrendingCategory[];
  count: number;
  error?: string;
}

const CARD_THEMES = [
  {
    gradientFrom: "from-primary_green/5",
    gradientTo: "to-secondary_green/5",
    border: "border-primary_green/20",
    iconBg: "from-primary_green to-secondary_green",
    textColor: "text-primary_green",
  },
  {
    gradientFrom: "from-accent/5",
    gradientTo: "to-accent/10",
    border: "border-accent/20",
    iconBg: "from-accent to-orange-400",
    textColor: "text-accent",
  },
  {
    gradientFrom: "from-blue-50",
    gradientTo: "to-blue-100",
    border: "border-blue-200",
    iconBg: "from-blue-500 to-blue-600",
    textColor: "text-blue-600",
  },
];

export default function TrendingInsightsSection() {
  const [trending, setTrending] = useState<TrendingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/ml/trending-categories?limit=3`);
      const data: TrendingResponse = await response.json();

      if (data.success && data.data) {
        setTrending(data.data);
      } else {
        setError(data.error || "Failed to load trending insights");
      }
    } catch (err) {
      console.error("Error fetching trending categories:", err);
      setError("Unable to load trending insights.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="bg-white border-t border-gray-100">
      <View className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-16">
        {/* Header */}
        <View className="mb-10">
          <Text className="text-3xl font-bold text-[#111827] mb-2">
            Trending Insights
          </Text>
          <Text className="text-gray-600">
            See what's moving in the market this week
          </Text>
        </View>

        {/* Loading State */}
        {loading && (
          <View className="flex items-center justify-center py-20">
            <ActivityIndicator size="large" color="#10B981" />
            <Text className="mt-4 text-gray-600">Loading trends...</Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View className="flex items-center justify-center py-20">
            <Text className="text-red-500 mb-4">{error}</Text>
            <Pressable
              onPress={fetchTrending}
              className="px-6 py-3 rounded-xl bg-[#10B981]"
            >
              <Text className="text-white font-semibold">Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Cards */}
        {!loading && !error && trending.length > 0 && (
          <View className="flex flex-col md:flex-row gap-6">
            {trending.map((item, index) => {
              const theme = CARD_THEMES[index % CARD_THEMES.length];
              const badgeLabel =
                item.avg_price_drop_pct != null
                  ? `${item.avg_price_drop_pct}% price drop`
                  : item.trend_label;

              return (
                <Pressable key={item.category} className="flex-1">
                  <View
                    className={`bg-gradient-to-br ${theme.gradientFrom} ${theme.gradientTo} border ${theme.border} rounded-2xl p-8 hover:shadow-lg transition-all`}
                  >
                    <View className="flex-row items-center justify-between mb-6">
                      <View
                        className={`w-14 h-14 bg-gradient-to-br ${theme.iconBg} rounded-xl flex items-center justify-center shadow-md`}
                      >
                        <FontAwesome6
                          name={item.icon || "circle-question"}
                          size={20}
                          color="#FFFFFF"
                        />
                      </View>
                      <Text className={`text-sm font-bold ${theme.textColor}`}>
                        {badgeLabel}
                      </Text>
                    </View>

                    <Text className="text-xl font-bold text-[#111827] mb-2">
                      {item.category}
                    </Text>
                    <Text className="text-sm text-gray-600 mb-6">
                      {item.description}
                    </Text>

                    <Pressable className="flex-row items-center gap-2">
                      <Text
                        className={`text-sm ${theme.textColor} font-semibold`}
                      >
                        View {item.category} deals
                      </Text>
                      <FontAwesome6
                        name="arrow-right"
                        size={14}
                        className={theme.textColor}
                      />
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && trending.length === 0 && (
          <View className="flex items-center justify-center py-20">
            <Text className="text-gray-500">
              No trending insights available.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
