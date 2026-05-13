import React, { useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Svg, Path, Line, Circle, Text as SvgText } from "react-native-svg";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

type RangeKey = "7D" | "30D" | "90D";
type StoreKey = "Aldi" | "Coles" | "Woolworths";

type Point = { xLabel: string; value: number };

type ProductSeries = {
   name: string;
   series: Record<StoreKey, Point[]>;
};

const PRIMARY = "#10B981"; // your primary_green
const GRID = "#E5E7EB";
const TEXT = "#111827";
const MUTED = "#6B7280";

// A couple of different line colors for readability
const STORE_COLORS: Record<StoreKey, string> = {
   Aldi: PRIMARY,
   Coles: "#F59E0B",
   Woolworths: "#6366F1",
};

export default function PriceHistoryTrendsSection() {
   const [range, setRange] = useState<RangeKey>("30D");
   const [selectedProduct, setSelectedProduct] = useState<string>("Milk Full Cream 2L");

   const products: Record<RangeKey, ProductSeries[]> = useMemo(() => {
      return {
         "7D": [
            {
               name: "Milk Full Cream 2L",
               series: {
                  Aldi: [
                     { xLabel: "D1", value: 3.7 },
                     { xLabel: "D3", value: 3.65 },
                     { xLabel: "D5", value: 3.58 },
                     { xLabel: "D7", value: 3.5 },
                  ],
                  Coles: [
                     { xLabel: "D1", value: 4.2 },
                     { xLabel: "D3", value: 4.15 },
                     { xLabel: "D5", value: 4.05 },
                     { xLabel: "D7", value: 3.8 },
                  ],
                  Woolworths: [
                     { xLabel: "D1", value: 4.4 },
                     { xLabel: "D3", value: 4.35 },
                     { xLabel: "D5", value: 4.28 },
                     { xLabel: "D7", value: 4.2 },
                  ],
               },
            },
         ],
         "30D": [
            {
               name: "Milk Full Cream 2L",
               series: {
                  Aldi: [
                     { xLabel: "Week 1", value: 4.7 },
                     { xLabel: "Week 2", value: 4.3 },
                     { xLabel: "Week 3", value: 3.9 },
                     { xLabel: "Week 4", value: 3.5 },
                  ],
                  Coles: [
                     { xLabel: "Week 1", value: 5.0 },
                     { xLabel: "Week 2", value: 4.7 },
                     { xLabel: "Week 3", value: 4.3 },
                     { xLabel: "Week 4", value: 3.8 },
                  ],
                  Woolworths: [
                     { xLabel: "Week 1", value: 5.0 },
                     { xLabel: "Week 2", value: 4.8 },
                     { xLabel: "Week 3", value: 4.6 },
                     { xLabel: "Week 4", value: 4.2 },
                  ],
               },
            },
            {
               name: "White Bread 700g",
               series: {
                  Aldi: [
                     { xLabel: "Week 1", value: 3.25 },
                     { xLabel: "Week 2", value: 3.1 },
                     { xLabel: "Week 3", value: 3.0 },
                     { xLabel: "Week 4", value: 2.9 },
                  ],
                  Coles: [
                     { xLabel: "Week 1", value: 3.35 },
                     { xLabel: "Week 2", value: 3.0 },
                     { xLabel: "Week 3", value: 2.7 },
                     { xLabel: "Week 4", value: 2.5 },
                  ],
                  Woolworths: [
                     { xLabel: "Week 1", value: 3.2 },
                     { xLabel: "Week 2", value: 3.05 },
                     { xLabel: "Week 3", value: 2.95 },
                     { xLabel: "Week 4", value: 2.8 },
                  ],
               },
            },
         ],
         "90D": [
            {
               name: "Milk Full Cream 2L",
               series: {
                  Aldi: [
                     { xLabel: "Wk 1", value: 4.9 },
                     { xLabel: "Wk 4", value: 4.6 },
                     { xLabel: "Wk 8", value: 4.1 },
                     { xLabel: "Wk 12", value: 3.5 },
                  ],
                  Coles: [
                     { xLabel: "Wk 1", value: 5.0 },
                     { xLabel: "Wk 4", value: 4.9 },
                     { xLabel: "Wk 8", value: 4.3 },
                     { xLabel: "Wk 12", value: 3.8 },
                  ],
                  Woolworths: [
                     { xLabel: "Wk 1", value: 5.1 },
                     { xLabel: "Wk 4", value: 5.0 },
                     { xLabel: "Wk 8", value: 4.6 },
                     { xLabel: "Wk 12", value: 4.2 },
                  ],
               },
            },
         ],
      };
   }, []);

   const currentProducts = products[range];
   const current = currentProducts.find((p) => p.name === selectedProduct) ?? currentProducts[0];

   const xLabels = current.series.Aldi.map((p) => p.xLabel);

   const stats = useMemo(() => {
      const allPoints: { store: StoreKey; value: number; label: string }[] = [];

      (Object.keys(current.series) as StoreKey[]).forEach((store) => {
         current.series[store].forEach((pt) => {
            allPoints.push({ store, value: pt.value, label: pt.xLabel });
         });
      });

      const lowest = allPoints.reduce((a, b) => (b.value < a.value ? b : a), allPoints[0]);
      const highest = allPoints.reduce((a, b) => (b.value > a.value ? b : a), allPoints[0]);

      const lastLabel = xLabels[xLabels.length - 1];
      const lastPoints = (Object.keys(current.series) as StoreKey[]).map((store) => {
         const last = current.series[store][current.series[store].length - 1];
         return { store, value: last.value, label: last.label };
      });
      lastPoints.sort((a, b) => a.value - b.value);
      const currentBest = lastPoints[0];

      return { lowest, highest, currentBest };
   }, [current, xLabels]);

   return (
      <View className="px-4 md:px-8 py-10 bg-[#F9FAFB]">
         <View className="w-full">
            {/* Section title */}
            <View className="mb-6">
               <Text className="text-3xl font-bold text-gray-900 mb-2">
                  Price History & Trends
               </Text>
               <Text className="text-base text-gray-600">
                  Track how prices have changed over time for your key items
               </Text>
            </View>

            {/* Card container */}
            <View className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
               {/* Card header row */}
               <View className="px-6 py-6 border-b border-gray-100 flex-row items-center justify-between">
                  <View>
                     <Text className="text-lg font-bold text-gray-900 mb-1">Price history</Text>
                     <Text className="text-sm text-gray-600">
                        Currently viewing:{" "}
                        <Text className="text-primary_green font-semibold">{selectedProduct}</Text>
                     </Text>
                  </View>

                  <View className="flex-row items-center gap-3">
                     <Text className="text-sm text-gray-500">Select product</Text>

                     {/* Faux dropdown (wire to real picker if you want) */}
                     <Pressable className="px-4 py-3 rounded-xl border border-gray-200 bg-white min-w-[220px] flex-row items-center justify-between">
                        <Text className="text-sm font-semibold text-gray-800">{selectedProduct}</Text>
                        <FontAwesome6 name="chevron-down" size={12} color="#6B7280" />
                     </Pressable>

                     {/* Range pills */}
                     <RangePill label="7D" active={range === "7D"} onPress={() => setRange("7D")} />
                     <RangePill label="30D" active={range === "30D"} onPress={() => setRange("30D")} />
                     <RangePill label="90D" active={range === "90D"} onPress={() => setRange("90D")} />
                  </View>
               </View>

               {/* Chart */}
               <View className="px-6 py-6">
                  <View className="rounded-2xl border border-gray-200 p-4 w-full">
                     <PriceLineChart
                        labels={xLabels}
                        series={current.series}
                        height={260}
                     />
                  </View>

                  {/* Bottom stat cards */}
                  <View className="flex-row gap-5 mt-6">
                     <StatCard
                        title="Lowest"
                        value={`$${stats.lowest.value.toFixed(2)}`}
                        subtitle={range === "30D" ? "Last 30 days" : `In last ${range}`}
                        emphasized={false}
                     />
                     <StatCard
                        title="Current"
                        value={`$${stats.currentBest.value.toFixed(2)}`}
                        subtitle={`${stats.currentBest.store} today`}
                        emphasized
                     />
                     <StatCard
                        title="Highest"
                        value={`$${stats.highest.value.toFixed(2)}`}
                        subtitle={`${stats.highest.store} peak price`}
                        emphasized={false}
                     />
                  </View>
               </View>
            </View>
         </View>
      </View>
   );
}

/* ---------------- Components ---------------- */

function RangePill({
   label,
   active,
   onPress,
}: {
   label: string;
   active: boolean;
   onPress: () => void;
}) {
   return (
      <Pressable
         onPress={onPress}
         className={[
            "px-4 py-2.5 rounded-xl border",
            active ? "bg-primary_green border-primary_green" : "bg-white border-gray-200",
         ].join(" ")}
      >
         <Text className={["text-sm font-semibold", active ? "text-white" : "text-gray-800"].join(" ")}>
            {label}
         </Text>
      </Pressable>
   );
}

function StatCard({
   title,
   value,
   subtitle,
   emphasized,
}: {
   title: string;
   value: string;
   subtitle: string;
   emphasized?: boolean;
}) {
   return (
      <View
         className={[
            "flex-1 rounded-2xl border p-6 items-center",
            emphasized ? "border-primary_green bg-primary_green/10" : "border-gray-200 bg-white",
         ].join(" ")}
      >
         <Text className="text-sm font-semibold text-gray-600">{title}</Text>
         <Text className={["text-3xl font-bold mt-2", emphasized ? "text-primary_green" : "text-gray-900"].join(" ")}>
            {value}
         </Text>
         <Text className={["text-sm mt-2", emphasized ? "text-primary_green font-semibold" : "text-gray-500"].join(" ")}>
            {subtitle}
         </Text>
      </View>
   );
}

function PriceLineChart({
   labels,
   series,
   height,
}: {
   labels: string[];
   series: Record<StoreKey, Point[]>;
   height: number;
}) {
   // Layout - use a larger base width for better responsiveness
   const width = 1200; // larger base width for full-width containers
   const padding = { top: 18, right: 18, bottom: 44, left: 48 };
   const innerW = width - padding.left - padding.right;
   const innerH = height - padding.top - padding.bottom;

   // Build min/max from all values
   const allVals: number[] = [];
   (Object.keys(series) as StoreKey[]).forEach((k) => {
      series[k].forEach((p) => allVals.push(p.value));
   });

   const minV = Math.min(...allVals);
   const maxV = Math.max(...allVals);
   const span = Math.max(0.0001, maxV - minV);

   const xCount = Math.max(1, labels.length - 1);

   const xFor = (i: number) => padding.left + (innerW * i) / xCount;
   const yFor = (v: number) => padding.top + innerH - (innerH * (v - minV)) / span;

   // Grid lines (4)
   const gridLines = 4;
   const yTicks = Array.from({ length: gridLines + 1 }).map((_, i) => {
      const t = i / gridLines;
      const val = maxV - span * t;
      const y = padding.top + innerH * t;
      return { y, val };
   });

   const makePath = (pts: Point[]) => {
      return pts
         .map((p, i) => {
            const x = xFor(i);
            const y = yFor(p.value);
            return `${i === 0 ? "M" : "L"} ${x} ${y}`;
         })
         .join(" ");
   };

   return (
      <View className="w-full" style={{ minHeight: height }}>
         <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
            {/* Horizontal grid */}
            {yTicks.map((t, idx) => (
               <React.Fragment key={idx}>
                  <Line
                     x1={padding.left}
                     x2={width - padding.right}
                     y1={t.y}
                     y2={t.y}
                     stroke={GRID}
                     strokeWidth={1}
                  />
                  <SvgText
                     x={padding.left - 10}
                     y={t.y + 4}
                     fontSize="12"
                     fill={MUTED}
                     textAnchor="end"
                  >
                     {`$${t.val.toFixed(2)}`}
                  </SvgText>
               </React.Fragment>
            ))}

            {/* X labels */}
            {labels.map((lab, i) => (
               <SvgText
                  key={lab}
                  x={xFor(i)}
                  y={height - 16}
                  fontSize="12"
                  fill={lab.toLowerCase().includes("week 4") ? PRIMARY : MUTED}
                  textAnchor="middle"
               >
                  {lab}
               </SvgText>
            ))}

            {/* Series lines + points */}
            {(Object.keys(series) as StoreKey[]).map((store) => {
               const pts = series[store];
               const path = makePath(pts);
               const color = STORE_COLORS[store];

               return (
                  <React.Fragment key={store}>
                     <Path d={path} stroke={color} strokeWidth={3} fill="none" />
                     {pts.map((p, i) => (
                        <Circle
                           key={`${store}-${i}`}
                           cx={xFor(i)}
                           cy={yFor(p.value)}
                           r={4}
                           fill={color}
                        />
                     ))}
                  </React.Fragment>
               );
            })}

            {/* Legend */}
            {(Object.keys(series) as StoreKey[]).map((store, i) => (
               <React.Fragment key={`legend-${store}`}>
                  <Circle cx={padding.left + i * 120} cy={14} r={5} fill={STORE_COLORS[store]} />
                  <SvgText
                     x={padding.left + i * 120 + 12}
                     y={18}
                     fontSize="12"
                     fill={TEXT}
                  >
                     {store}
                  </SvgText>
               </React.Fragment>
            ))}
         </Svg>
      </View>
   );
}
