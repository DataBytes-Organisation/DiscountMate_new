import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import InsightStatCard from "../../components/insights/InsightStatCard";
import InsightBarRow from "../../components/insights/InsightBarRow";
import {
  computeRetailerRow,
  fetchProductsForInsights,
  InsightsProduct,
  normalizeCheapest,
} from "../../lib/insightsData";

export default function InsightsCategories() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<InsightsProduct[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const data = await fetchProductsForInsights();
      if (mounted) {
        setProducts(data);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const computed = useMemo(() => {
    // category -> totals
    const map = new Map<
      string,
      { items: number; totalSavings: number; totalOriginal: number; totalCurrent: number }
    >();

    for (const p of products) {
      const category = p.category || "Other";
      const retailers = normalizeCheapest(p.retailers || []);

      let bestSavingsForProduct = 0;
      let bestOriginal = 0;
      let bestCurrent = 0;

      for (const r of retailers) {
        const { current, original, savings } = computeRetailerRow(r);
        if (current != null && original != null && original > current) {
          // pick the best savings row as representative for category rollups
          if (savings > bestSavingsForProduct) {
            bestSavingsForProduct = savings;
            bestOriginal = original;
            bestCurrent = current;
          }
        }
      }

      const cur = map.get(category) || {
        items: 0,
        totalSavings: 0,
        totalOriginal: 0,
        totalCurrent: 0,
      };

      cur.items += 1;
      cur.totalSavings += bestSavingsForProduct;
      cur.totalOriginal += bestOriginal;
      cur.totalCurrent += bestCurrent;

      map.set(category, cur);
    }

    const rows = Array.from(map.entries()).map(([category, v]) => {
      const avgSavings = v.items > 0 ? v.totalSavings / v.items : 0;
      const avgDiscount =
        v.totalOriginal > 0 ? ((v.totalOriginal - v.totalCurrent) / v.totalOriginal) * 100 : 0;

      return {
        category,
        items: v.items,
        totalSavings: v.totalSavings,
        avgSavings,
        avgDiscount,
      };
    });

    rows.sort((a, b) => b.avgDiscount - a.avgDiscount);

    const best = rows[0];
    const totalSavedAll = rows.reduce((s, r) => s + r.totalSavings, 0);
    const topAvgDiscount = best ? best.avgDiscount : 0;

    return { rows, totalSavedAll, topAvgDiscount, bestCategory: best?.category ?? "—" };
  }, [products]);

  const maxDiscount = Math.max(1, ...computed.rows.map((r) => r.avgDiscount));

  return (
    <ScrollView className="flex-1 bg-[#F9FAFB]" contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text className="text-2xl font-extrabold text-dark">Category Trends</Text>
      <Text className="text-gray-600">
        Ranks categories by average discount (based on best saving per product).
      </Text>

      {loading ? (
        <View className="bg-white border border-gray-200 rounded-2xl p-5">
          <Text className="text-gray-600">Loading insights…</Text>
        </View>
      ) : (
        <>
          <View className="flex-row gap-3">
            <InsightStatCard
              label="Best category"
              value={computed.bestCategory}
              sub={`Top avg discount: ${computed.topAvgDiscount.toFixed(1)}%`}
            />
            <InsightStatCard
              label="Total saved (all categories)"
              value={`$${computed.totalSavedAll.toFixed(2)}`}
              sub={`${computed.rows.length} categories`}
            />
          </View>

          <View className="gap-3">
            {computed.rows.map((r) => (
              <InsightBarRow
                key={r.category}
                title={r.category}
                rightText={`${r.avgDiscount.toFixed(1)}% • ${r.items} items`}
                pct={(r.avgDiscount / maxDiscount) * 100}
              />
            ))}
          </View>

          {computed.rows.length === 0 && (
            <View className="bg-white border border-gray-200 rounded-2xl p-5">
              <Text className="text-gray-600">
                No data found. Ensure your products include `category` and retailers include
                `price` + `originalPrice`.
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
