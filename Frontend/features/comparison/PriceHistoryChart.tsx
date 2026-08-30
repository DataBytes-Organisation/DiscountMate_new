import React, { useMemo } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import type { ForecastResult, PriceHistoryPoint } from "../../types/Comparison";
import { buildChartSeries } from "./presentation";
import { formatRetailerName } from "./presentation";

const COLORS = ["#159447", "#DC263C", "#0F4C9A", "#E78513"];

export function PriceHistoryChart({ history, forecasts }: {
   history: PriceHistoryPoint[];
   forecasts: ForecastResult[];
}) {
   const { width } = useWindowDimensions();
   const chartWidth = Math.max(300, Math.min(1060, width - 72));
   const chartHeight = 230;
   const series = useMemo(() => buildChartSeries(history, forecasts), [forecasts, history]);
   const allPoints = series.flatMap((item) => item.points);
   if (!allPoints.length) {
      return <Text className="px-5 py-10 text-center text-sm text-gray-500">Price history is not available yet.</Text>;
   }
   const values = allPoints.map((point) => point.value);
   const min = Math.min(...values) - 0.25;
   const max = Math.max(...values) + 0.25;
   const timestamps = allPoints.map((point) => new Date(point.timestamp).getTime());
   const minTime = Math.min(...timestamps);
   const maxTime = Math.max(...timestamps);
   const x = (timestamp: string) => 40 + ((new Date(timestamp).getTime() - minTime) / Math.max(1, maxTime - minTime)) * (chartWidth - 60);
   const y = (value: number) => 15 + ((max - value) / Math.max(0.01, max - min)) * (chartHeight - 50);

   return (
      <View className="px-4 pb-4 pt-3">
         <View accessibilityLabel={chartAccessibilityLabel(series)}>
            <Svg width={chartWidth} height={chartHeight}>
               {[0, 0.5, 1].map((ratio) => {
                  const value = max - (max - min) * ratio;
                  const lineY = y(value);
                  return (
                     <React.Fragment key={ratio}>
                        <Line x1={40} y1={lineY} x2={chartWidth - 20} y2={lineY} stroke="#E5E7EB" />
                        <SvgText x={2} y={lineY + 4} fontSize="10" fill="#9CA3AF">${value.toFixed(2)}</SvgText>
                     </React.Fragment>
                  );
               })}
               {series.map((item, index) => {
                  const historical = item.points.filter((point) => !point.forecast);
                  const forecast = item.points.find((point) => point.forecast);
                  const path = historical.map((point, pointIndex) => (
                     `${pointIndex === 0 ? "M" : "L"}${x(point.timestamp)},${y(point.value)}`
                  )).join(" ");
                  const last = historical.at(-1);
                  return (
                     <React.Fragment key={item.retailerId}>
                        {path ? <Path d={path} fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth={2.5} /> : null}
                        {historical.map((point) => (
                           <Circle
                              key={`${item.retailerId}-${point.timestamp}`}
                              cx={x(point.timestamp)}
                              cy={y(point.value)}
                              r={historical.length === 1 ? 5 : 3.5}
                              fill={COLORS[index % COLORS.length]}
                              stroke="#FFFFFF"
                              strokeWidth={1.5}
                           />
                        ))}
                        {forecast && last ? (
                           <Line
                              x1={x(last.timestamp)} y1={y(last.value)}
                              x2={x(forecast.timestamp)} y2={y(forecast.value)}
                              stroke={COLORS[index % COLORS.length]}
                              strokeWidth={2.5}
                              strokeDasharray={forecast.forecastKind === "model" ? "6 5" : undefined}
                           />
                        ) : null}
                        {forecast ? <Circle cx={x(forecast.timestamp)} cy={y(forecast.value)} r={4} fill={COLORS[index % COLORS.length]} /> : null}
                     </React.Fragment>
                  );
               })}
               <SvgText x={40} y={chartHeight - 4} fontSize="10" fill="#9CA3AF">
                  {formatShortChartDate(new Date(minTime).toISOString())}
               </SvgText>
               <SvgText x={chartWidth - 20} y={chartHeight - 4} fontSize="10" fill="#9CA3AF" textAnchor="end">
                  {formatShortChartDate(new Date(maxTime).toISOString())}
               </SvgText>
            </Svg>
         </View>
         <View className="flex-row flex-wrap gap-4 px-2">
            {series.map((item, index) => (
               <View key={item.retailerId} className="flex-row items-center gap-2">
                  <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <Text className="text-xs text-gray-600">{formatRetailerName(item.retailerName)}</Text>
               </View>
            ))}
            {series.some((item) => item.points.some((point) => point.forecastKind === "model")) ? (
               <Text className="text-xs text-gray-400">Dashed extension = model forecast</Text>
            ) : null}
         </View>
      </View>
   );
}

function formatShortChartDate(value: string): string {
   return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(value));
}

function chartAccessibilityLabel(series: ReturnType<typeof buildChartSeries>): string {
   const details = series.map((item) => {
      const observed = item.points.filter((point) => !point.forecast).at(-1);
      const outlook = item.points.find((point) => point.forecast);
      return `${formatRetailerName(item.retailerName)}: ${observed ? `$${observed.value.toFixed(2)} on ${formatShortChartDate(observed.timestamp)}` : "no observed price"}${outlook ? `; 14-day outlook $${outlook.value.toFixed(2)} on ${formatShortChartDate(outlook.timestamp)}` : ""}`;
   });
   return `Price history chart with ${series.length} retailer series. ${details.join(". ")}`;
}
