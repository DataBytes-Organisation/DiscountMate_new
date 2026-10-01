import React from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import type { ShoppingSession, ShoppingSessionItem } from "../../types/Comparison";
import { ActionButton, Card, SectionHeader } from "./ComparisonPrimitives";
import { formatMoney, formatRetailerName } from "./presentation";
import { RetailerBadge } from "./RetailerBadge";

export function ShoppingSessionView({ session, onToggle, onOpenRetailer, onLinkFailed }: {
   session: ShoppingSession;
   onToggle: (item: ShoppingSessionItem, checked: boolean) => void;
   onOpenRetailer?: (item: ShoppingSessionItem) => void;
   onLinkFailed?: (item: ShoppingSessionItem) => void;
}) {
   const items = session.groups.flatMap((group) => group.items);
   const checked = items.filter((item) => item.checked).length;
   const progress = items.length ? Math.round((checked / items.length) * 100) : 0;
   const nextItem = items.find((item) => !item.checked && item.linkStatus === "exact" && item.productUrl)
      || items.find((item) => item.linkStatus === "exact" && item.productUrl);
   const openProduct = async (item: ShoppingSessionItem) => {
      if (!item.productUrl || item.linkStatus !== "exact") return;
      try {
         await Linking.openURL(item.productUrl);
         onOpenRetailer?.(item);
      } catch {
         onLinkFailed?.(item);
      }
   };

   return (
      <View className="gap-5">
         <Card className="overflow-hidden border-emerald-200 bg-emerald-50">
            <View className="gap-5 p-6 md:flex-row md:items-center md:justify-between">
               <View className="flex-1">
                  <Text className="text-xs font-bold uppercase tracking-widest text-emerald-700">Shopping Mode</Text>
                  <Text className="mt-2 text-2xl font-bold text-gray-950">Your recommended basket is ready</Text>
                  <Text className="mt-2 text-sm text-gray-600">Check items off as you shop. Your original saved grocery list is unchanged.</Text>
                  <Text className="mt-2 text-xs leading-5 text-gray-500">DiscountMate opens one retailer product page at a time. Quantities are shown here for reference and are not transferred to the retailer cart.</Text>
                  <View className="mt-4 h-2 overflow-hidden rounded-full bg-white"><View className="h-full rounded-full bg-emerald-600" style={{ width: `${progress}%` }} /></View>
                  <Text className="mt-2 text-xs font-semibold text-emerald-800">{checked} of {items.length} collected</Text>
               </View>
               <ActionButton
                  label={nextItem ? "Open next product" : "No product links available"}
                  icon="arrow-up-right-from-square"
                  primary
                  disabled={!nextItem}
                  onPress={() => { if (nextItem) void openProduct(nextItem); }}
               />
            </View>
         </Card>

         {session.groups.map((group) => (
            <Card key={group.retailerName} className="overflow-hidden">
               <SectionHeader
                  title={`Shop at ${formatRetailerName(group.retailerName)}`}
                  subtitle={`${group.items.length} ${group.items.length === 1 ? "item" : "items"} · ${formatMoney(groupTotal(group.items))} · ${capabilityCopy(group.retailerCapability)}`}
                  trailing={<RetailerBadge name={group.retailerName} showName={false} size={34} />}
               />
               {group.items.map((item) => (
                  <View key={item.lineItemId || item.productId} className="flex-row items-center gap-3 border-t border-gray-100 px-5 py-4">
                     <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: item.checked }}
                        accessibilityLabel={`Mark ${item.productName} as ${item.checked ? "not collected" : "collected"}`}
                        onPress={() => onToggle(item, !item.checked)}
                        className={`h-7 w-7 items-center justify-center rounded-lg border ${item.checked ? "border-emerald-600 bg-emerald-600" : "border-gray-300 bg-white"}`}
                     >
                        {item.checked ? <FontAwesome6 name="check" size={12} color="#FFFFFF" /> : null}
                     </Pressable>
                     <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} className="h-12 w-12" resizeMode="contain" /> : <FontAwesome6 name="image" size={15} color="#CBD5E1" />}
                     </View>
                     <View className="flex-1">
                        <Text className={`text-sm font-semibold ${item.checked ? "text-gray-400 line-through" : "text-gray-900"}`}>{item.productName}</Text>
                        <Text className="mt-1 text-xs text-gray-500">Qty {item.quantity} · {formatMoney(item.price)} each</Text>
                     </View>
                     <Text className="text-sm font-bold text-gray-900">{formatMoney(lineTotal(item))}</Text>
                     {item.linkStatus === "exact" && item.productUrl ? (
                        <Pressable onPress={() => void openProduct(item)} className="rounded-lg border border-gray-200 px-3 py-2">
                           <Text className="text-xs font-semibold text-emerald-700">Open product</Text>
                        </Pressable>
                     ) : <Text className="text-xs text-gray-400">{item.linkStatus === "unsupported" ? "Catalogue only" : "Link unavailable"}</Text>}
                  </View>
               ))}
            </Card>
         ))}
      </View>
   );
}

function capabilityCopy(capability: ShoppingSession["groups"][number]["retailerCapability"]) {
   if (capability === "catalogue_only") return "catalogue handoff";
   if (capability === "store_required") return "participating store required";
   return "exact product pages";
}

function lineTotal(item: ShoppingSessionItem) {
   return { amount: (Number(item.price.amount) * item.quantity).toFixed(2), currency: "AUD" as const };
}

function groupTotal(items: ShoppingSessionItem[]) {
   return { amount: items.reduce((sum, item) => sum + Number(item.price.amount) * item.quantity, 0).toFixed(2), currency: "AUD" as const };
}
