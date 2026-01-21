import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import InsightStatCard from "../../components/insights/InsightStatCard";
import {
  computeRetailerRow,
  fetchProductsForInsights,
  InsightsProduct,
  normalizeCheapest,
} from "../../lib/insightsData";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export default function InsightsSavings() {
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
    const rows: {
      productId: string;
      productName: string;
      category: string;
      bestRetailer?: string;
      bestSavings: number;
      bestDiscountPct: number;
      cheapestPrice?: number;
    }[] = [];

    let totalSavings = 0;
    let totalOriginal = 0;
    let totalCurrent = 0;
    let countedRetailerPairs = 0;

    for (const p of products) {
      const retailers = normalizeCheapest(p.retailers || []);
      let bestSavings = 0;
      let bestDiscountPct = 0;
      let bestRetailer = "";
      let cheapestPrice: number | undefined;

      for (const r of retailers) {
        const { current, original, savings, discountPct } = computeRetailerRow(r);

        if (current != null && r.isCheapest) cheapestPrice = current;

        // global sums (only count if original+current exist)
        if (current != null && original != null && original > 0) {
          totalOriginal += original;
          totalCurrent += current;
          totalSavings += savings;
          countedRetailerPairs += 1;
        }

        // per product best savings
        if (savings > bestSavings) {
          bestSavings = savings;
          bestDiscountPct = discountPct;
          bestRetailer = r.name;
        }
      }

      rows.push({
        productId: p.id,
        productName: p.name,
        category: p.category || "Other",
        bestRetailer: bestRetailer || undefined,
        bestSavings,
        bestDiscountPct,
        cheapestPrice,
      });
    }

    const avgDiscount =
      totalOriginal > 0 ? ((totalOriginal - totalCurrent) / totalOriginal) * 100 : 0;

    const topSavers = [...rows]
      .sort((a, b) => b.bestSavings - a.bestSavings)
      .slice(0, 8);

    const withSavings = rows.filter((r) => r.bestSavings > 0).length;

    return {
      totalSavings,
      totalOriginal,
      totalCurrent,
      avgDiscount,
      countedRetailerPairs,
      productsCount: products.length,
      withSavings,
      topSavers,
    };
  }, [products]);

  return (
    <ScrollView className="flex-1 bg-[#F9FAFB]" contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text className="text-2xl font-extrabold text-dark">Savings Overview</Text>
      <Text className="text-gray-600">
        Calculated from retailer prices that include both original and current values.
      </Text>

      {loading ? (
        <View className="bg-white border border-gray-200 rounded-2xl p-5">
          <Text className="text-gray-600">Loading insights…</Text>
        </View>
      ) : (
        <>
          <View className="flex-row gap-3">
            <InsightStatCard
              label="Total saved"
              value={money(computed.totalSavings)}
              sub={`${computed.withSavings} products with savings`}
            />
            <InsightStatCard
              label="Avg discount"
              value={`${computed.avgDiscount.toFixed(1)}%`}
              sub={`${computed.countedRetailerPairs} price-pairs used`}
            />
          </View>

          <View className="flex-row gap-3">
            <InsightStatCard label="Original total" value={money(computed.totalOriginal)} />
            <InsightStatCard label="Current total" value={money(computed.totalCurrent)} />
          </View>

          <View className="bg-white border border-gray-200 rounded-2xl p-5">
            <Text className="text-lg font-extrabold text-dark mb-3">Top savers</Text>

            {computed.topSavers.length === 0 ? (
              <Text className="text-gray-600">
                No savings detected yet. Make sure your data includes originalPrice + price.
              </Text>
            ) : (
              <View className="gap-3">
                {computed.topSavers.map((x) => (
                  <View
                    key={x.productId}
                    className="border border-gray-100 rounded-xl p-4 bg-[#FFFFFF]"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="font-bold text-dark" numberOfLines={1}>
                        {x.productName}
                      </Text>
                      <Text className="font-extrabold text-primary_green">
                        {money(x.bestSavings)}
                      </Text>
                    </View>

                    <Text className="text-xs text-gray-500 mt-1">
                      {x.category} • Best at {x.bestRetailer ?? "—"} • {x.bestDiscountPct.toFixed(1)}%
                    </Text>

                    {typeof x.cheapestPrice === "number" && (
                      <Text className="text-xs text-gray-500 mt-1">
                        Cheapest price: {money(x.cheapestPrice)}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          <Pressable
            className="bg-white border border-gray-200 rounded-2xl p-5"
            onPress={() => setProducts([...products])}
          >
            <Text className="font-bold text-dark">Refresh calculations</Text>
            <Text className="text-gray-600 mt-1">
              (Uses latest in-memory data. To refresh from API, reload the screen.)
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}