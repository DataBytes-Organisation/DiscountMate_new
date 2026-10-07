import React from "react";
import { Image, Text, View } from "react-native";
import { formatRetailerName } from "./presentation";

const RETAILER_STYLES: Record<string, { background: string; foreground: string; short: string }> = {
   aldi: { background: "#0B3B8C", foreground: "#FFFFFF", short: "A" },
   coles: { background: "#E32636", foreground: "#FFFFFF", short: "C" },
   woolworths: { background: "#168342", foreground: "#FFFFFF", short: "W" },
   iga: { background: "#F28C18", foreground: "#FFFFFF", short: "IGA" },
};

const RETAILER_LOGOS: Record<string, {
   source: number;
   aspectRatio: number;
   background: string;
}> = {
   aldi: {
      source: require("../../assets/retailers/aldi.png"),
      aspectRatio: 0.84,
      background: "#FFFFFF",
   },
   coles: {
      source: require("../../assets/retailers/coles.png"),
      aspectRatio: 2.8,
      background: "#FFFFFF",
   },
   woolworths: {
      source: require("../../assets/retailers/woolworths.png"),
      aspectRatio: 1.04,
      background: "#FFFFFF",
   },
   iga: {
      source: require("../../assets/retailers/iga.png"),
      aspectRatio: 1.55,
      background: "#FFFFFF",
   },
};

export function RetailerBadge({ name, showName = true, size = 28 }: {
   name: string;
   showName?: boolean;
   size?: number;
}) {
   const key = name.trim().toLowerCase();
   const logo = RETAILER_LOGOS[key];
   const style = RETAILER_STYLES[key] || {
      background: "#E5E7EB",
      foreground: "#374151",
      short: formatRetailerName(name).slice(0, 2).toUpperCase(),
   };

   return (
      <View className="flex-row items-center gap-2" accessibilityLabel={`${formatRetailerName(name)} retailer`}>
         {logo ? (
            <View
               className="items-center justify-center overflow-hidden rounded-lg border border-gray-100"
               style={{
                  width: Math.min(size * logo.aspectRatio, size * 2.4),
                  height: size,
                  backgroundColor: logo.background,
                  padding: 2,
               }}
            >
               <Image
                  source={logo.source}
                  accessibilityIgnoresInvertColors
                  resizeMode="contain"
                  style={{ width: "100%", height: "100%" }}
               />
            </View>
         ) : (
            <View
               className="items-center justify-center rounded-lg"
               style={{ width: size, height: size, backgroundColor: style.background }}
            >
               <Text style={{ color: style.foreground, fontSize: size < 30 ? 9 : 11, fontWeight: "800" }}>
                  {style.short}
               </Text>
            </View>
         )}
         {showName ? <Text className="text-sm font-semibold text-gray-900">{formatRetailerName(name)}</Text> : null}
      </View>
   );
}
