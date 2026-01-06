import React, { useState } from "react";
import { View, Text, Pressable, LayoutChangeEvent } from "react-native";

interface ProductPriceHistoryProps {
   productId?: string | string[];
}

type Timeframe = "7d" | "30d" | "90d" | "1y";

export default function ProductPriceHistory({
   productId,
}: ProductPriceHistoryProps) {
   const [selectedTimeframe, setSelectedTimeframe] =
      useState<Timeframe>("30d");
   const [containerWidth, setContainerWidth] = useState(0);

   const timeframes: { label: string; value: Timeframe }[] = [
      { label: "7 Days", value: "7d" },
      { label: "30 Days", value: "30d" },
      { label: "90 Days", value: "90d" },
      { label: "1 Year", value: "1y" },
   ];

   // Mock chart data, you can swap per timeframe later
   const chartData = {
      labels: [
         "Jan 1",
         "Jan 5",
         "Jan 10",
         "Jan 15",
         "Jan 20",
         "Jan 25",
         "Jan 30",
         "Feb 3",
      ],
      datasets: [
         {
            name: "Aldi",
            data: [4.7, 4.5, 4.3, 4.1, 3.9, 3.7, 3.6, 3.5],
            color: "#10B981",
         },
         {
            name: "Coles",
            data: [5.0, 4.9, 4.7, 4.5, 4.3, 4.1, 3.9, 3.8],
            color: "#F59E0B",
         },
         {
            name: "Woolworths",
            data: [5.0, 4.95, 4.85, 4.75, 4.6, 4.45, 4.3, 4.2],
            color: "#8B5CF6",
         },
      ],
   };

   const priceStats = {
      current: 3.5,
      average: 4.15,
      lowest: 3.5,
      highest: 5.0,
   };

   const chartHeight = 220;
   const padding = 40;
   const chartWidth = containerWidth > 0 ? containerWidth : 600; // fallback width
   const areaWidth = Math.max(0, chartWidth - padding * 2);
   const areaHeight = chartHeight - padding * 2;

   const handleLayout = (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;
      if (width > 0) {
         setContainerWidth(width);
      }
   };

   const allValues = chartData.datasets.flatMap((d) => d.data);
   const minPrice = Math.min(...allValues);
   const maxPrice = Math.max(...allValues);
   const priceRange = maxPrice - minPrice || 1;

   const priceToY = (price: number) => {
      const normalized = (price - minPrice) / priceRange;
      return areaHeight - normalized * areaHeight + padding;
   };

   const indexToX = (index: number) => {
      if (areaWidth <= 0) return padding;
      return (index / (chartData.labels.length - 1)) * areaWidth + padding;
   };

   return (
      <View className="bg-white rounded-2xl border border-gray-200 p-6 mt-6">
         {/* Header with timeframe selector on the right */}
         <View className="flex-row items-center justify-between mb-6">
            <Text className="text-xl font-bold text-gray-900">
               Price History
            </Text>

            <View className="flex-row gap-2">
               {timeframes.map((tf) => {
                  const active = selectedTimeframe === tf.value;
                  return (
                     <Pressable
                        key={tf.value}
                        onPress={() => setSelectedTimeframe(tf.value)}
                        className={[
                           "px-4 py-2 rounded-xl border",
                           active
                              ? "bg-primary_green border-primary_green"
                              : "bg-gray-50 border-gray-200",
                        ].join(" ")}
                     >
                        <Text
                           className={[
                              "font-semibold text-sm",
                              active ? "text-white" : "text-gray-700",
                           ].join(" ")}
                        >
                           {tf.label}
                        </Text>
                     </Pressable>
                  );
               })}
            </View>
         </View>

         {/* Chart */}
         <View className="mb-6" onLayout={handleLayout}>
            <View
               className="bg-white rounded-xl border border-gray-100 overflow-hidden"
               style={{ height: chartHeight, width: "100%" }}
            >
               {/* Y axis labels */}
               <View className="absolute left-0 top-4 bottom-10 w-10 justify-between px-2">
                  <Text className="text-xs text-gray-500">
                     ${maxPrice.toFixed(2)}
                  </Text>
                  <Text className="text-xs text-gray-500">
                     ${((minPrice + maxPrice) / 2).toFixed(2)}
                  </Text>
                  <Text className="text-xs text-gray-500">
                     ${minPrice.toFixed(2)}
                  </Text>
               </View>

               {/* Lines and points */}
               <View
                  className="absolute"
                  style={{
                     left: padding,
                     top: padding / 2,
                     width: areaWidth,
                     height: areaHeight,
                  }}
               >
                  {chartData.datasets.map((dataset, idx) => {
                     const points = dataset.data.map((price, i) => ({
                        x: indexToX(i),
                        y: priceToY(price),
                     }));

                     return (
                        <View
                           key={idx}
                           className="absolute"
                           style={{ width: areaWidth, height: areaHeight }}
                        >
                           {points.slice(1).map((pt, i) => {
                              const prev = points[i];
                              const dx = pt.x - prev.x;
                              const dy = pt.y - prev.y;
                              const length = Math.sqrt(dx * dx + dy * dy);
                              const angle = Math.atan2(dy, dx);

                              return (
                                 <View
                                    key={i}
                                    className="absolute"
                                    style={{
                                       left: prev.x - padding,
                                       top: prev.y - padding,
                                       width: length,
                                       height: 2,
                                       backgroundColor: dataset.color,
                                       transform: [{ rotate: `${angle}rad` }],
                                    }}
                                 />
                              );
                           })}

                           {points.map((pt, i) => (
                              <View
                                 key={i}
                                 className="absolute rounded-full border-2 border-white"
                                 style={{
                                    left: pt.x - padding - 5,
                                    top: pt.y - padding - 5,
                                    width: 10,
                                    height: 10,
                                    backgroundColor: dataset.color,
                                 }}
                              />
                           ))}
                        </View>
                     );
                  })}
               </View>

               {/* X axis labels */}
               <View className="absolute bottom-2 left-10 right-4 flex-row justify-between">
                  {chartData.labels.map((label, i) => (
                     <Text
                        key={i}
                        className="text-[11px] text-gray-500"
                        numberOfLines={1}
                     >
                        {label}
                     </Text>
                  ))}
               </View>
            </View>

            {/* Legend */}
            <View className="flex-row justify-center gap-6 mt-4">
               {chartData.datasets.map((dataset, i) => (
                  <View key={i} className="flex-row items-center gap-2">
                     <View
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: dataset.color }}
                     />
                     <Text className="text-sm text-gray-600">
                        {dataset.name}
                     </Text>
                  </View>
               ))}
            </View>
         </View>

         {/* Stats row */}
         <View className="flex-row flex-wrap gap-4">
            {/* Current price card highlighted */}
            <View className="flex-1 min-w-[150px] bg-primary_green/5 border border-primary_green/30 rounded-2xl p-4">
               <Text className="text-xs text-gray-500 mb-1">
                  Current Price
               </Text>
               <Text className="text-2xl font-bold text-primary_green">
                  ${priceStats.current.toFixed(2)}
               </Text>
            </View>

            <View className="flex-1 min-w-[150px] bg-gray-50 rounded-2xl p-4">
               <Text className="text-xs text-gray-500 mb-1">
                  Avg. Price (30d)
               </Text>
               <Text className="text-2xl font-bold text-gray-900">
                  ${priceStats.average.toFixed(2)}
               </Text>
            </View>

            <View className="flex-1 min-w-[150px] bg-gray-50 rounded-2xl p-4">
               <Text className="text-xs text-gray-500 mb-1">
                  Lowest (30d)
               </Text>
               <Text className="text-2xl font-bold text-gray-900">
                  ${priceStats.lowest.toFixed(2)}
               </Text>
            </View>

            <View className="flex-1 min-w-[150px] bg-gray-50 rounded-2xl p-4">
               <Text className="text-xs text-gray-500 mb-1">
                  Highest (30d)
               </Text>
               <Text className="text-2xl font-bold text-gray-900">
                  ${priceStats.highest.toFixed(2)}
               </Text>
            </View>
         </View>
      </View>
   );
}
