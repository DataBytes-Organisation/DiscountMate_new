import React, { useState } from "react";
import { Image, Linking, Pressable, ScrollView, Switch, Text, TextInput, View, useWindowDimensions } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useShoppingLists } from "../../app/(tabs)/ShoppingListsContext";
import { useToast } from "react-native-toast-notifications";
import { ProductImageScanner, type ImageSearchResult } from "../../components/layout/ProductImageScanner";
import { trackComparisonEvents } from "../../services/comparisons";
import type { Alternative, ComparisonProduct, ProductComparison } from "../../types/Comparison";
import { ActionButton, Card, ErrorState, LoadingState, SectionHeader, WarningBanner } from "./ComparisonPrimitives";
import { PriceHistoryChart } from "./PriceHistoryChart";
import { formatMoney, formatPack, formatRetailerName } from "./presentation";
import { RetailerBadge } from "./RetailerBadge";
import { useProductComparisonController } from "./useComparisonControllers";

export function SingleProductComparison() {
   const controller = useProductComparisonController();
   const { activeListId, addItemToActiveList } = useShoppingLists();
   const { width } = useWindowDimensions();
   const compact = width < 760;
   const comparison = controller.comparison;
   const displayedAdvice = comparison ? normalizeAdviceForDisplay(comparison) : null;
   const [scanNotice, setScanNotice] = useState<string | null>(null);
   const [addingToList, setAddingToList] = useState(false);
   const toast = useToast();
   const handleScanResults = (results: ImageSearchResult[]) => {
      const first = results[0];
      const detectedName = String(first?.name || first?.product_name || first?.title || "").trim();
      if (!detectedName) {
         setScanNotice("A product was detected, but its name could not be matched. Try searching manually.");
         return;
      }
      controller.setQuery(detectedName);
      setScanNotice(`We detected “${detectedName}”. Choose the matching Silver product below to confirm.`);
   };

   return (
      <View className="gap-5">
         <View>
            <View className="flex-row items-center rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
               <FontAwesome6 name="magnifying-glass" size={15} color="#9CA3AF" />
               <TextInput
                  accessibilityLabel="Search for a product to compare"
                  value={controller.query}
                  onChangeText={controller.setQuery}
                  placeholder="Search an eligible product"
                  placeholderTextColor="#9CA3AF"
                  className="ml-3 min-h-[40px] flex-1 text-sm text-gray-900 outline-none"
               />
               {controller.selectedProduct ? (
                  <Pressable onPress={controller.clear} accessibilityLabel="Clear selected product" className="px-3 py-2">
                     <FontAwesome6 name="xmark" size={14} color="#6B7280" />
                  </Pressable>
               ) : null}
               <View className="ml-2">
                  <ProductImageScanner onResults={handleScanResults} compact />
               </View>
            </View>
            {scanNotice ? <Text className="mt-2 text-xs text-emerald-700">{scanNotice}</Text> : null}
            {controller.results.length ? (
               <View accessibilityLabel="Product search results" accessibilityRole="list" className="mt-2">
                  <Card className="overflow-hidden">
                     <ScrollView
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator
                        style={{ maxHeight: compact ? 320 : 420 }}
                     >
                        {controller.results.map((product) => (
                           <Pressable
                              key={product.id}
                              accessibilityRole="button"
                              onPress={() => controller.selectProduct(product)}
                              className="flex-row items-center gap-3 border-b border-gray-100 px-4 py-3 hover:bg-emerald-50"
                           >
                              <ProductImage product={product} size={42} />
                              <View className="flex-1">
                                 <Text className="text-sm font-semibold text-gray-900">{product.name}</Text>
                                 <Text className="mt-1 text-xs text-gray-500">
                                    {[product.brand, formatPack(product.packQuantity, product.packUom)].filter(Boolean).join(" · ")}
                                 </Text>
                                 <View className="mt-2 flex-row flex-wrap items-center gap-2">
                                    {product.availableRetailers?.map((retailer) => (
                                       <RetailerBadge key={retailer.retailerId} name={retailer.retailerName} showName={false} size={20} />
                                    ))}
                                    <Text className="text-[11px] font-medium text-gray-500">
                                       {product.offerCount || 0} current {(product.offerCount || 0) === 1 ? "offer" : "offers"}
                                    </Text>
                                 </View>
                              </View>
                           </Pressable>
                        ))}
                     </ScrollView>
                  </Card>
               </View>
            ) : null}
         </View>

         {controller.availableRetailers.length ? (
            <View className={`${compact ? "gap-3" : "flex-row items-center justify-between"}`}>
               <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: "center" }}>
                  <Text className="text-xs text-gray-500">Retailers:</Text>
                  <FilterChip
                     label="All retailers"
                     active={controller.retailerIds.length === 0}
                     onPress={controller.clearRetailers}
                  />
                  {controller.availableRetailers.map((retailer) => (
                     <FilterChip
                        key={retailer.id}
                        label={retailer.name}
                        active={controller.retailerIds.includes(retailer.id)}
                        onPress={() => controller.toggleRetailer(retailer.id)}
                     />
                  ))}
               </ScrollView>
               <View className="flex-row items-center gap-2">
                  <Switch
                     accessibilityLabel="Include similar products"
                     value={controller.includeSimilar}
                     onValueChange={controller.toggleSimilar}
                     trackColor={{ false: "#D1D5DB", true: "#A7F3D0" }}
                     thumbColor={controller.includeSimilar ? "#0DAD79" : "#F9FAFB"}
                  />
                  <Text className="text-xs text-gray-600">Include similar products</Text>
               </View>
            </View>
         ) : null}

         {!controller.selectedProduct ? (
            <DiscoveryEmptyState onSearch={controller.setQuery} onScanResults={handleScanResults} />
         ) : controller.loading && !comparison ? (
            <LoadingState />
         ) : controller.error && !comparison ? (
            <ErrorState message={controller.error} onRetry={() => void controller.retry()} />
         ) : comparison ? (
            <>
               {controller.error ? <WarningBanner warning={{ section: "offers", code: "refresh_failed", message: controller.error, severity: "warning" }} /> : null}
               {comparison.warnings
                  .filter((warning) => !["retailer_partial", "forecast_partial"].includes(warning.code))
                  .map((warning) => <WarningBanner key={`${warning.section}-${warning.code}`} warning={warning} />)}

               <Card className={`${compact ? "" : "flex-row"} overflow-hidden`}>
                  <View className={`${compact ? "" : "w-[31%]"} p-5`}>
                     <View className="flex-row gap-4">
                        <ProductImage product={comparison.product} size={76} />
                        <View className="flex-1">
                           <View className="self-start rounded-full bg-emerald-50 px-2 py-1">
                              <Text className="text-[10px] font-semibold text-emerald-700">Exact match</Text>
                           </View>
                           <Text className="mt-2 text-base font-bold text-gray-900">{comparison.product.name}</Text>
                           <Text className="mt-1 text-xs text-gray-500">
                              {[formatPack(comparison.product.packQuantity, comparison.product.packUom), comparison.product.categoryName, comparison.product.brand]
                                 .filter(Boolean).join(" · ")}
                           </Text>
                        </View>
                     </View>
                     <View className="mt-4">
                        <ActionButton
                           compact
                           primary
                           disabled={!activeListId || !comparison.cheapest || addingToList}
                           label={addingToList ? "Adding…" : activeListId ? "Add to grocery list" : "Log in to add to a list"}
                           onPress={async () => {
                              if (!comparison.cheapest) return;
                              setAddingToList(true);
                              try {
                                 const result = await addItemToActiveList({
                                    id: comparison.product.id,
                                    comparisonProductId: comparison.product.id,
                                    deProductId: comparison.product.id,
                                    sourceProductId: comparison.cheapest.sourceProductId || comparison.product.sourceProductId || comparison.cheapest.productId,
                                    name: comparison.product.name,
                                    price: Number(comparison.cheapest.price.amount),
                                    quantity: 1,
                                    store: comparison.cheapest.retailerName,
                                    image: comparison.product.imageUrl || undefined,
                                    category: comparison.product.categoryName,
                                    categoryId: comparison.product.categoryId || undefined,
                                    gtin: comparison.product.gtin || undefined,
                                    brand: comparison.product.brand || undefined,
                                    packQuantity: comparison.product.packQuantity || undefined,
                                    packUom: comparison.product.packUom || undefined,
                                 });
                                 toast.show(
                                    result.action === "updated"
                                       ? "Quantity updated in Grocery List."
                                       : "Added to Grocery List successfully.",
                                    { type: "success" }
                                 );
                              } catch (cause) {
                                 toast.show(cause instanceof Error ? cause.message : "The product could not be added. Please retry.", { type: "danger" });
                              } finally {
                                 setAddingToList(false);
                              }
                           }}
                        />
                     </View>
                  </View>

                  <View className={`${compact ? "border-t" : "w-[35%] border-l"} border-gray-100 p-5`}>
                     <Text className="text-xs font-semibold text-emerald-700">
                        {comparison.cheapest ? `Cheapest at ${formatRetailerName(comparison.cheapest.retailerName)}` : "No compatible retailer offer"}
                     </Text>
                     <Text className="mt-2 text-4xl font-bold tracking-tight text-gray-950">
                        {formatMoney(comparison.cheapest?.price)}
                     </Text>
                     {comparison.cheapest?.unitPrice ? (
                        <Text className="mt-2 text-xs text-gray-500">${Number(comparison.cheapest.unitPrice).toFixed(2)} / normalized unit</Text>
                     ) : null}
                     <Text className="mt-3 text-xs text-emerald-700">{comparison.cheapest ? "Latest available positive price · stock inferred" : "Try again after the next Silver load."}</Text>
                  </View>

                  <View className={`${compact ? "border-t" : "flex-1 border-l"} border-gray-100 bg-emerald-50 p-5`}>
                     <View className="flex-row items-center gap-3">
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                           <FontAwesome6 name={displayedAdvice?.type === "wait" ? "clock" : displayedAdvice?.type === "buy_now" ? "check" : "tags"} size={13} color="#0DAD79" />
                        </View>
                        <Text className="text-base font-bold text-emerald-900">{displayedAdvice?.title}</Text>
                     </View>
                     <Text className="mt-3 text-sm leading-6 text-emerald-800">{displayedAdvice?.reason}</Text>
                  </View>
               </Card>

               <Card className="overflow-hidden">
                  <SectionHeader
                     title="Compare retailers"
                     subtitle="Shelf prices normalized to AUD and the selected product pack."
                     trailing={<SnapshotInfo dataWatermark={comparison.dataWatermark} />}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                     <View className="min-w-[850px] flex-1">
                        <View className="flex-row bg-gray-50 px-5 py-3">
                           {[["Retailer", 190], ["Price", 120], ["Unit price", 140], ["Difference", 130], ["Promotion", 150], ["Availability", 150]].map(([label, cellWidth]) => (
                              <Text key={String(label)} style={{ width: Number(cellWidth) }} className="text-xs font-semibold text-gray-500">{label}</Text>
                           ))}
                        </View>
                        {comparison.offers.map((offer, index) => (
                           <View key={offer.retailerId} className={`flex-row items-center border-t border-gray-100 px-5 py-4 ${index === 0 ? "bg-emerald-50/60" : ""}`}>
                              <View style={{ width: 190 }} className="gap-1">
                                 <RetailerBadge name={offer.retailerName} />
                                 {index === 0 ? <Text className="text-[10px] font-semibold text-emerald-700">Cheapest exact offer</Text> : null}
                              </View>
                              <Text style={{ width: 120 }} className="text-sm font-bold text-gray-900">{formatMoney(offer.price)}</Text>
                              <Text style={{ width: 140 }} className="text-xs text-gray-500">{offer.unitPrice ? `$${Number(offer.unitPrice).toFixed(2)}` : "Unavailable"}</Text>
                              <Text style={{ width: 130 }} className="text-xs text-gray-600">{Number(offer.difference.amount) === 0 ? "Cheapest" : `+${formatMoney(offer.difference)}`}</Text>
                              <Text style={{ width: 150 }} className="text-xs text-gray-600">{offer.specialText || (offer.isOnSpecial ? "On special" : "No promotion")}</Text>
                              <View style={{ width: 150 }} className="items-start">
                                 <Text className="text-xs font-medium text-emerald-700">In stock*</Text>
                                 {offer.productUrl ? (
                                    <Pressable onPress={() => {
                                       void trackComparisonEvents([{ name: "offer_opened", properties: { productId: comparison.comparisonProductId || comparison.product.id, retailerId: offer.retailerId } }]);
                                       void Linking.openURL(offer.productUrl!);
                                    }} className="mt-1">
                                       <Text className="text-xs font-semibold text-emerald-700">View offer</Text>
                                    </Pressable>
                                 ) : null}
                              </View>
                           </View>
                        ))}
                        {comparison.unavailableRetailers?.map((retailer) => (
                           <View key={retailer.retailerId} className="flex-row items-center border-t border-gray-100 px-5 py-4 opacity-60">
                              <View style={{ width: 190 }}><RetailerBadge name={retailer.retailerName} /></View>
                              <Text style={{ width: 120 }} className="text-xs text-gray-500">Unavailable</Text>
                              <Text style={{ width: 140 }} className="text-xs text-gray-400">—</Text>
                              <Text style={{ width: 130 }} className="text-xs text-gray-400">—</Text>
                              <Text style={{ width: 150 }} className="text-xs text-gray-400">—</Text>
                              <Text style={{ width: 150 }} className="text-xs text-gray-500">{unavailableReason(retailer.reason)}</Text>
                           </View>
                        ))}
                        <Text className="border-t border-gray-100 px-5 py-3 text-[11px] text-gray-400">* Availability inferred from the latest available positive price.</Text>
                     </View>
                  </ScrollView>
               </Card>

               <Card className="overflow-hidden">
                  <SectionHeader
                     title="Price history and 14-day outlook"
                     subtitle="Latest available prices and a 14-day price outlook."
                     trailing={(
                        <View className="rounded-lg bg-gray-100 px-3 py-2">
                           <Text className="text-xs font-semibold text-gray-600">
                              {comparison.forecasts.some((forecast) => forecast.forecastKind === "model")
                                 ? "Model forecast"
                                 : comparison.forecasts.length
                                    ? "Snapshot-based outlook"
                                    : "Outlook unavailable"}
                           </Text>
                        </View>
                     )}
                  />
                  <PriceHistoryChart history={comparison.history} forecasts={comparison.forecasts} />
                  {comparison.forecasts.some((forecast) => forecast.forecastKind === "baseline") ? (
                     <Text className="px-5 pb-4 text-xs text-gray-500">Prices are shown as unchanged over the next 14 days based on the latest snapshot.</Text>
                  ) : null}
                  {comparison.forecasts.some((forecast) => forecast.forecastKind === "model") || !comparison.forecasts.length ? (
                     <View className="flex-row flex-wrap gap-4 border-t border-gray-100 px-5 py-3">
                        {comparison.forecasts.filter((forecast) => forecast.forecastKind === "model").map((forecast) => (
                        <Text key={forecast.retailerId} className="text-xs text-gray-500">
                           {formatRetailerName(forecast.retailerName)}: {forecast.confidenceLabel} ({Math.round((forecast.confidence || 0) * 100)}%)
                        </Text>
                        ))}
                        {!comparison.forecasts.length ? <Text className="text-xs text-gray-500">The 14-day outlook is temporarily unavailable; price history remains available.</Text> : null}
                     </View>
                  ) : null}
               </Card>

               <AlternativesSection
                  alternatives={comparison.alternatives}
                  onCompare={(product) => controller.selectProduct(product)}
               />
            </>
         ) : null}
      </View>
   );
}

function normalizeAdviceForDisplay(comparison: ProductComparison) {
   const advice = comparison.advice as ProductComparison["advice"] | { type: "monitor"; title: string; reason: string };
   if (advice.type !== "monitor") return advice;

   const offers = [...comparison.offers].sort((left, right) => Number(left.price.amount) - Number(right.price.amount));
   if (!offers.length) {
      return { type: "compare_offers" as const, title: "Compare current offers", reason: "No compatible current offers are available.", basis: "no_offer" as const };
   }
   if (offers.length === 1) {
      return {
         type: "compare_offers" as const,
         title: "Compare current offers",
         reason: `One verified current offer is available at ${formatRetailerName(offers[0].retailerName)} for ${formatMoney(offers[0].price)}.`,
         basis: "single_offer" as const,
      };
   }

   const cheapest = offers[0];
   const highest = offers.at(-1)!;
   return {
      type: "compare_offers" as const,
      title: "Compare current offers",
      reason: `Current prices range from ${formatMoney(cheapest.price)} at ${formatRetailerName(cheapest.retailerName)} to ${formatMoney(highest.price)} across ${offers.length} retailers.`,
      basis: "current_price_comparison" as const,
   };
}

function unavailableReason(reason: ProductComparison["unavailableRetailers"][number]["reason"]) {
   if (reason === "no_exact_product_match") return "No verified exact match";
   if (reason === "incompatible_pack") return "Incompatible pack";
   if (reason === "retailer_data_unavailable") return "Retailer data unavailable";
   return "No current offer";
}

function DiscoveryEmptyState({ onSearch, onScanResults }: {
   onSearch: (value: string) => void;
   onScanResults: (results: ImageSearchResult[]) => void;
}) {
   const examples = ["Apple Sauce", "Drinking Chocolate", "Beef Stroganoff Recipe Base", "Kids Yoghurt Pouch"];
   return (
      <Card className="overflow-hidden">
         <View className="items-center bg-emerald-50 px-6 py-10">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 shadow-sm">
               <FontAwesome6 name="tags" size={22} color="#FFFFFF" />
            </View>
            <Text className="mt-5 text-center text-2xl font-bold text-gray-950">Find the best price before you shop</Text>
            <Text className="mt-2 max-w-[620px] text-center text-sm leading-6 text-gray-600">Search or scan one product to compare compatible prices, verified savings, price history, and alternatives.</Text>
            <View className="mt-5"><ProductImageScanner onResults={onScanResults} label="Scan a product" /></View>
            <Text className="mt-5 text-xs font-semibold uppercase tracking-wide text-emerald-800">Popular searches</Text>
            <View className="mt-3 flex-row flex-wrap justify-center gap-2">
               {examples.map((example) => (
                  <Pressable key={example} onPress={() => onSearch(example)} className="rounded-full border border-emerald-200 bg-white px-4 py-2">
                     <Text className="text-xs font-semibold text-emerald-800">Try {example}</Text>
                  </Pressable>
               ))}
            </View>
         </View>
         <View className="gap-4 p-6 md:flex-row">
            <DiscoveryBenefit icon="store" title="Compare four retailers" body="See compatible ALDI, Coles, Woolworths, and IGA offers together." />
            <DiscoveryBenefit icon="chart-line" title="Understand the timing" body="Review observations and clearly labelled forecast confidence." />
            <DiscoveryBenefit icon="arrows-rotate" title="Find alternatives" body="Compare other sizes and similar products by normalized value." />
         </View>
         <View className="flex-row flex-wrap items-center justify-center gap-5 border-t border-gray-100 px-5 py-4">
            {["aldi", "coles", "woolworths", "iga"].map((retailer) => <RetailerBadge key={retailer} name={retailer} />)}
         </View>
      </Card>
   );
}

function DiscoveryBenefit({ icon, title, body }: { icon: string; title: string; body: string }) {
   return (
      <View className="flex-1 rounded-xl border border-gray-100 bg-white p-4">
         <FontAwesome6 name={icon} size={15} color="#0DAD79" />
         <Text className="mt-3 text-sm font-bold text-gray-900">{title}</Text>
         <Text className="mt-1 text-xs leading-5 text-gray-500">{body}</Text>
      </View>
   );
}

function SnapshotInfo({ dataWatermark }: { dataWatermark: string | null }) {
   const label = dataWatermark
      ? `Showcase data snapshot: ${new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Melbourne" }).format(new Date(dataWatermark))}`
      : "Showcase data snapshot date is unavailable";
   return (
      <Pressable accessibilityLabel={label} accessibilityHint="Shows when the comparison dataset was observed" {...({ title: label } as any)} className="flex-row items-center gap-2 rounded-full bg-gray-100 px-3 py-2">
         <FontAwesome6 name="circle-info" size={12} color="#6B7280" />
         <Text className="text-xs text-gray-500">Data snapshot</Text>
      </Pressable>
   );
}

function AlternativesSection({ alternatives, onCompare }: {
   alternatives: { sameProductOtherSizes: Alternative[]; similarProducts: Alternative[] } | Alternative[];
   onCompare: (product: ComparisonProduct) => void;
}) {
   const groups = Array.isArray(alternatives)
      ? { sameProductOtherSizes: [], similarProducts: alternatives }
      : alternatives;
   return (
      <Card className="overflow-hidden">
         <SectionHeader title="Better-value alternatives" subtitle="Alternative sizes and compatible similar products are ranked by normalized unit price." />
         <View className="gap-5 p-5">
            <AlternativeGroup label="Same product, other sizes" items={groups.sameProductOtherSizes} onCompare={onCompare} />
            <AlternativeGroup label="Similar products" items={groups.similarProducts} onCompare={onCompare} />
         </View>
      </Card>
   );
}

function AlternativeGroup({ label, items, onCompare }: { label: string; items: Alternative[]; onCompare: (product: ComparisonProduct) => void }) {
   return (
      <View>
         <Text className="mb-3 text-sm font-semibold text-gray-700">{label}</Text>
         {items.length ? (
            <View className="flex-row flex-wrap gap-3">
               {items.map((item) => (
                  <View key={item.productId} className="min-w-[230px] flex-1 rounded-xl border border-gray-200 p-4">
                     <View className="flex-row gap-3">
                        <ProductImage product={{ name: item.name, imageUrl: item.imageUrl }} size={54} />
                        <View className="flex-1">
                           <Text className="text-sm font-semibold text-gray-900">{item.name}</Text>
                           <Text className="mt-1 text-xs text-gray-500">{item.brand} · {formatPack(item.packQuantity, item.packUom)}</Text>
                        </View>
                     </View>
                     <Text className="mt-4 text-xl font-bold text-gray-900">{formatMoney(item.cheapestOffer.price)}</Text>
                     <Text className="mt-1 text-xs text-gray-500">Cheapest at {formatRetailerName(item.cheapestOffer.retailerName)}</Text>
                     {item.matchReason ? (
                        <Text className="mt-2 text-xs text-emerald-700">
                           {item.matchReason === "same_product_other_size" ? "Same brand and product, different size" : "Compatible category, unit and product name"}
                           {item.matchScore !== undefined ? ` · ${Math.round(item.matchScore * 100)}% match` : ""}
                        </Text>
                     ) : null}
                     {item.verifiedSaving ? <Text className="mt-1 text-xs font-semibold text-emerald-700">Save {formatMoney(item.verifiedSaving)} per normalized unit</Text> : null}
                     <View className="mt-4">
                        <ActionButton label="Compare" onPress={() => onCompare({
                           id: item.productId,
                           name: item.name,
                           brand: item.brand,
                           categoryName: item.categoryName,
                           packQuantity: item.packQuantity,
                           packUom: item.packUom,
                           imageUrl: item.imageUrl,
                        })} />
                     </View>
                  </View>
               ))}
            </View>
         ) : <Text className="text-sm text-gray-500">No verified alternatives are available for this group.</Text>}
      </View>
   );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
   return (
      <Pressable onPress={onPress} className={`rounded-full border px-3 py-2 ${active ? "border-gray-900 bg-gray-900" : "border-gray-200 bg-white"}`}>
         <Text className={`text-xs font-semibold ${active ? "text-white" : "text-gray-600"}`}>{label}</Text>
      </Pressable>
   );
}

function ProductImage({ product, size }: { product: Pick<ComparisonProduct, "name" | "imageUrl">; size: number }) {
   return (
      <View className="items-center justify-center overflow-hidden rounded-lg bg-gray-100" style={{ width: size, height: size }}>
         {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={{ width: size, height: size }} resizeMode="contain" /> : <FontAwesome6 name="image" size={18} color="#CBD5E1" />}
      </View>
   );
}
