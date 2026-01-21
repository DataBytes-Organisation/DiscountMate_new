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

export default function InsightsRetailers() {
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
    const map = new Map<
      string,
      {
        deals: number;
        cheapestWins: number;
        totalSavings: number;
        totalOriginal: number;
        totalCurrent: number;
      }
    >();

    for (const p of products) {
      const retailers = normalizeCheapest(p.retailers || []);

      for (const r of retailers) {
        const row = computeRetailerRow(r);

        const cur = map.get(r.name) || {
          deals: 0,
          cheapestWins: 0,
          totalSavings: 0,
          totalOriginal: 0,
          totalCurrent: 0,
        };

        cur.deals += 1;
        if (r.isCheapest) cur.cheapestWins += 1;

        if (row.current != null && row.original != null && row.original > 0) {
          cur.totalSavings += row.savings;
          cur.totalOriginal += row.original;
          cur.totalCurrent += row.current;
        }

        map.set(r.name, cur);
      }
    }

    const rows = Array.from(map.entries()).map(([retailer, v]) => {
      const avgDiscount =
        v.totalOriginal > 0 ? ((v.totalOriginal - v.totalCurrent) / v.totalOriginal) * 100 : 0;

      const winRate = v.deals > 0 ? (v.cheapestWins / v.deals) * 100 : 0;

      return {
        retailer,
        deals: v.deals,
        cheapestWins: v.cheapestWins,
        winRate,
        totalSavings: v.totalSavings,
        avgDiscount,
      };
    });

    // Primary sort: avg discount, secondary: win rate
    rows.sort((a, b) => b.avgDiscount - a.avgDiscount || b.winRate - a.winRate);

    const best = rows[0];
    const totalSavedAll = rows.reduce((s, r) => s + r.totalSavings, 0);

    return {
      rows,
      bestRetailer: best?.retailer ?? "—",
      bestAvgDiscount: best?.avgDiscount ?? 0,
      totalSavedAll,
    };
  }, [products]);

  const maxDiscount = Math.max(1, ...computed.rows.map((r) => r.avgDiscount));

  return (
    <ScrollView className="flex-1 bg-[#F9FAFB]" contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text className="text-2xl font-extrabold text-dark">Retailer Performance</Text>
      <Text className="text-gray-600">
        Compares average discount and how often each retailer is the cheapest.
      </Text>

      {loading ? (
        <View className="bg-white border border-gray-200 rounded-2xl p-5">
          <Text className="text-gray-600">Loading insights…</Text>
        </View>
      ) : (
        <>
          <View className="flex-row gap-3">
            <InsightStatCard
              label="Best retailer"
              value={computed.bestRetailer}
              sub={`Avg discount: ${computed.bestAvgDiscount.toFixed(1)}%`}
            />
            <InsightStatCard
              label="Total saved (all retailers)"
              value={`$${computed.totalSavedAll.toFixed(2)}`}
              sub={`${computed.rows.length} retailers`}
            />
          </View>

          <View className="gap-3">
            {computed.rows.map((r) => (
              <View key={r.retailer} className="gap-2">
                <InsightBarRow
                  title={r.retailer}
                  rightText={`${r.avgDiscount.toFixed(1)}% avg • ${r.winRate.toFixed(0)}% cheapest`}
                  pct={(r.avgDiscount / maxDiscount) * 100}
                />
                <View className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <Text className="text-gray-600 text-sm">
                    Deals: <Text className="font-bold text-dark">{r.deals}</Text> • Cheapest wins:{" "}
                    <Text className="font-bold text-dark">{r.cheapestWins}</Text> • Saved:{" "}
                    <Text className="font-bold text-primary_green">${r.totalSavings.toFixed(2)}</Text>
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {computed.rows.length === 0 && (
            <View className="bg-white border border-gray-200 rounded-2xl p-5">
              <Text className="text-gray-600">
                No retailer data found. Ensure your products include `retailers[]`.
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}