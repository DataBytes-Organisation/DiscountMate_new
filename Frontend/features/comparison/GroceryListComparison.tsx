import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Switch, Text, View, useWindowDimensions } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useRouter } from "expo-router";
import { useShoppingLists } from "../../app/(tabs)/ShoppingListsContext";
import {
   applyComparisonSubstitution,
   dismissComparisonSubstitution,
   downloadComparisonCsv,
   startComparisonShopping,
   trackComparisonEvents,
} from "../../services/comparisons";
import type { ComparisonObjective, ComparisonPlan, GroceryComparisonRun } from "../../types/Comparison";
import { ActionButton, Card, EmptyState, ErrorState, LoadingState, SectionHeader, WarningBanner } from "./ComparisonPrimitives";
import { formatMoney, formatResolutionReason, formatRetailerName } from "./presentation";
import { useGroceryComparisonController } from "./useComparisonControllers";
import { RetailerBadge } from "./RetailerBadge";

const OBJECTIVES: { id: ComparisonObjective; label: string }[] = [
   { id: "lowest_total", label: "Lowest total cost" },
   { id: "one_retailer", label: "One retailer only" },
   { id: "fewest_substitutions", label: "Fewest substitutions" },
];

export function GroceryListComparison() {
   const { width } = useWindowDimensions();
   const router = useRouter();
   const compact = width < 860;
   const { lists, activeListId, isLoading: listsLoading, isAuthenticated, setActiveList, updateListItemQuantity } = useShoppingLists();
   const [selectedListId, setSelectedListId] = useState<string | null>(activeListId);
   const [notice, setNotice] = useState<string | null>(null);
   const controller = useGroceryComparisonController(selectedListId);
   const selectedList = lists.find((list) => list.id === selectedListId) || null;
   const recommendedPlan = controller.run?.plans[0] || null;

   useEffect(() => {
      const nextId = activeListId || lists[0]?.id || null;
      if (nextId && nextId !== selectedListId) setSelectedListId(nextId);
   }, [activeListId, lists, selectedListId]);

   const chooseList = (listId: string) => {
      setSelectedListId(listId);
      setActiveList(listId);
   };

   const handleQuantity = async (itemId: string, quantity: number) => {
      if (!selectedList) return;
      const previousQuantity = selectedList.items.find((item) => item.id === itemId)?.quantity;
      if (previousQuantity === undefined) return;
      setNotice(null);
      try {
         await updateListItemQuantity(selectedList.id, itemId, Math.max(1, quantity));
         await controller.execute(450, true);
      } catch (cause) {
         await updateListItemQuantity(selectedList.id, itemId, previousQuantity).catch(() => undefined);
         setNotice(cause instanceof Error ? cause.message : "The quantity could not be saved and was rolled back.");
      }
   };

   const handleExport = async () => {
      if (!controller.run || !recommendedPlan) return;
      try {
         await downloadComparisonCsv(controller.run.id, recommendedPlan.id);
         void trackComparisonEvents([{ name: "export_completed", properties: { runId: controller.run.id } }]);
      } catch (cause) {
         setNotice(cause instanceof Error ? cause.message : "Export failed.");
      }
   };

   const beginShopping = async () => {
      if (!controller.run || !recommendedPlan) return;
      try {
         const result = await startComparisonShopping(controller.run.id, recommendedPlan.id);
         router.push(`/(tabs)/shopping-session/${result.sessionId}` as any);
      } catch (cause) {
         setNotice(cause instanceof Error ? cause.message : "Shopping links are unavailable.");
      }
   };

   if (isAuthenticated === null || listsLoading) return <LoadingState label="Loading your saved lists…" />;
   if (!isAuthenticated) {
      return (
         <Card className="overflow-hidden">
            <View className="items-center bg-emerald-50 px-6 py-12">
               <View className="h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600"><FontAwesome6 name="basket-shopping" size={21} color="#FFFFFF" /></View>
               <Text className="mt-5 text-center text-xl font-bold text-gray-950">Sign in to compare your grocery list</Text>
               <Text className="mt-2 max-w-[560px] text-center text-sm leading-6 text-gray-600">Save a list once, keep it synchronized with your basket, and compare the complete shop across retailers.</Text>
               <View className="mt-6 flex-row gap-3">
                  <ActionButton label="Sign in" primary onPress={() => router.push("/(auth)/login")} />
                  <ActionButton label="Create account" onPress={() => router.push("/(auth)/register")} />
               </View>
            </View>
         </Card>
      );
   }
   if (!lists.length) {
      return <EmptyState title="No saved grocery lists" body="Create a grocery list first, then return here to compare the complete basket." />;
   }

   return (
      <View className="gap-5">
         <Card className="overflow-hidden">
            <View className={`${compact ? "gap-4" : "flex-row items-center justify-between"} px-5 py-4`}>
               <View>
                  <Text className="text-xs text-gray-500">Saved list</Text>
                  <View className="mt-1 flex-row items-center gap-2">
                     <Text className="text-base font-bold text-gray-900">{selectedList?.name || "Choose a list"}</Text>
                     <View className="rounded-full bg-gray-100 px-2 py-1">
                        <Text className="text-[10px] text-gray-600">{selectedList?.items.length || 0} items</Text>
                     </View>
                  </View>
               </View>
               <View className="flex-row items-center gap-2">
                  <ActionButton label="Clear comparison" compact onPress={controller.clear} />
               </View>
            </View>
            <View className="border-t border-gray-100 px-5 py-3">
               <Text className="mb-2 text-xs font-semibold text-gray-500">Import an existing DiscountMate list</Text>
               <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {lists.map((list) => (
                     <Pressable
                        key={list.id}
                        onPress={() => chooseList(list.id)}
                        className={`rounded-lg border px-3 py-2 ${selectedListId === list.id ? "border-primary_green bg-emerald-50" : "border-gray-200 bg-white"}`}
                     >
                        <Text className={`text-xs font-semibold ${selectedListId === list.id ? "text-emerald-800" : "text-gray-600"}`}>{list.name}</Text>
                     </Pressable>
                  ))}
               </ScrollView>
            </View>
         </Card>

         {notice ? <WarningBanner warning={{ section: "action", code: "action_failed", message: notice, severity: "warning" }} /> : null}
         {controller.errorCode === "no_mapped_items" && !controller.run ? (
            <EmptyState
               title="No comparable products in this list yet"
               body="The list is safe and unchanged. Add products selected from DiscountMate search, or wait for the catalogue mapping to be completed."
            />
         ) : controller.error && !controller.run ? <ErrorState message={controller.error} onRetry={() => void controller.execute()} /> : null}
         {controller.loading && !controller.run ? <LoadingState label="Comparing your basket across retailers…" /> : null}

         {controller.run ? (
            <>
               {controller.run.warnings.map((warning) => <WarningBanner key={`${warning.section}-${warning.code}`} warning={warning} />)}
               {controller.loading ? <Text className="text-center text-xs text-gray-500">Refreshing this comparison…</Text> : null}
               {recommendedPlan ? <RecommendedPlan plan={recommendedPlan} /> : (
                  <EmptyState title="No basket plan available" body="The selected list does not currently have compatible retailer prices." />
               )}

               <View className={`${compact ? "gap-5" : "flex-row gap-5"}`}>
                  <OptimizerControls controller={controller} compact={compact} />
                  <RetailerComparisonTable run={controller.run} />
               </View>

               {selectedList ? (
                  <Card className="overflow-hidden">
                     <SectionHeader title="Your grocery list" subtitle={`${selectedList.items.length} items · quantity changes save to the list and create a new run`} />
                     {selectedList.items.map((item) => {
                        const result = recommendedPlan?.items.find((candidate) => candidate.lineItemId === item.id || candidate.productId === item.id || candidate.productName === item.name);
                        const resolution = controller.run?.itemResolutions?.find((candidate) => (
                           candidate.lineItemId === item.id || candidate.legacyProductId === item.id
                        ));
                        return (
                           <View key={item.id} className="flex-row items-center gap-3 border-t border-gray-100 px-5 py-4">
                              <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                                 {item.image || result?.imageUrl ? <Image source={{ uri: item.image || result?.imageUrl || "" }} className="h-10 w-10" resizeMode="contain" /> : <FontAwesome6 name="image" size={14} color="#CBD5E1" />}
                              </View>
                              <View className="flex-1">
                                 <Text className="text-sm font-semibold text-gray-900">{item.name}</Text>
                                 <Text className="mt-1 text-xs text-gray-500">
                                    {result
                                       ? `${formatRetailerName(result.retailerName)} · latest exact offer`
                                       : formatResolutionReason(resolution?.resolutionReason)}
                                 </Text>
                              </View>
                              <View className="flex-row items-center rounded-lg border border-gray-200">
                                 <Pressable accessibilityLabel={`Decrease ${item.name} quantity`} onPress={() => void handleQuantity(item.id, item.quantity - 1)} className="px-3 py-2"><Text className="text-gray-500">−</Text></Pressable>
                                 <Text className="min-w-[24px] text-center text-sm text-gray-900">{item.quantity}</Text>
                                 <Pressable accessibilityLabel={`Increase ${item.name} quantity`} onPress={() => void handleQuantity(item.id, item.quantity + 1)} className="px-3 py-2"><Text className="text-gray-500">+</Text></Pressable>
                              </View>
                              <Text className="w-[78px] text-right text-sm font-bold text-gray-900">{result ? formatMoney(result.price) : "—"}</Text>
                           </View>
                        );
                     })}
                  </Card>
               ) : null}

               {recommendedPlan ? <BasketBreakdown plan={recommendedPlan} /> : null}

               <View className={`${compact ? "gap-5" : "flex-row gap-5"}`}>
                  {recommendedPlan?.savings ? <VerifiedSavings plan={recommendedPlan} /> : null}
                  <Suggestions run={controller.run} setRun={controller.setRun} setNotice={setNotice} />
               </View>

               {recommendedPlan ? (
                  <Card className={`${compact ? "gap-4" : "flex-row items-center justify-between"} border-emerald-600 bg-emerald-700 px-5 py-5`}>
                     <View>
                        <Text className="text-sm font-bold text-white">Recommended plan</Text>
                        <Text className="mt-1 text-xs text-emerald-100">
                           {recommendedPlan.retailers.map((retailer) => retailer.retailerName).join(" + ")} · {formatMoney(recommendedPlan.total)}
                        </Text>
                     </View>
                     <View className="flex-row flex-wrap gap-2">
                        <ActionButton label="Export CSV" onPress={() => void handleExport()} />
                        <ActionButton label="Start shopping" icon="arrow-right" primary onPress={() => void beginShopping()} />
                     </View>
                  </Card>
               ) : null}
            </>
         ) : null}
      </View>
   );
}

function RecommendedPlan({ plan }: { plan: ComparisonPlan }) {
   return (
      <Card className="overflow-hidden border-emerald-200 bg-emerald-100">
         <View className="p-6 md:flex-row md:items-start md:justify-between">
            <View>
               <View className="flex-row items-center gap-2">
                  <View className="rounded-full bg-white/70 px-3 py-1"><Text className="text-[10px] font-bold text-emerald-800">Best overall value</Text></View>
                  <Text className="text-xs text-emerald-800">Recommended</Text>
               </View>
               <Text className="mt-3 text-sm text-emerald-900">{plan.retailers.map((item) => formatRetailerName(item.retailerName)).join(" + ")}</Text>
               <Text className="mt-1 text-4xl font-bold text-emerald-800">{formatMoney(plan.total)}</Text>
               <Text className="mt-2 text-sm font-semibold text-emerald-800">{plan.savings ? `Save ${formatMoney(plan.savings)} across ${plan.comparableItemCount} comparable ${plan.comparableItemCount === 1 ? "item" : "items"}` : "Savings unavailable until another retailer has a compatible price"}</Text>
            </View>
            <View className="mt-5 gap-2 md:mt-0">
               <Text className="text-sm text-emerald-800">✓ {plan.coverage.found} of {plan.coverage.total} products found</Text>
               <Text className="text-sm text-emerald-800">+ {plan.substitutions} substitutions</Text>
               <Text className="text-sm text-emerald-800">+ {plan.retailers.length} shopping {plan.retailers.length === 1 ? "trip" : "trips"}</Text>
            </View>
         </View>
      </Card>
   );
}

function OptimizerControls({ controller, compact }: { controller: ReturnType<typeof useGroceryComparisonController>; compact: boolean }) {
   return (
      <Card className={`${compact ? "" : "w-[250px]"} p-4`}>
         <Text className="text-sm font-bold text-gray-900">Optimise for</Text>
         <View className="mt-3 gap-2">
            {OBJECTIVES.map((option) => (
               <Pressable disabled={controller.loading} key={option.id} onPress={() => controller.setObjective(option.id)} className={`flex-row items-center gap-3 rounded-lg px-3 py-3 ${controller.objective === option.id ? "bg-emerald-50" : ""} ${controller.loading ? "opacity-60" : ""}`}>
                  <View className={`h-4 w-4 rounded-full border ${controller.objective === option.id ? "border-emerald-600 bg-emerald-600" : "border-gray-400"}`} />
                  <Text className={`text-xs ${controller.objective === option.id ? "font-semibold text-emerald-800" : "text-gray-600"}`}>{option.label}</Text>
               </Pressable>
            ))}
         </View>
         {controller.objective === "fewest_substitutions" && controller.run?.plans[0]?.substitutions === 0 ? <Text className="mt-3 text-[11px] leading-4 text-gray-500">This plan already uses no substitutions, so it may match the lowest-total result.</Text> : null}
         <View className="my-4 h-px bg-gray-100" />
         <Text className="text-xs text-gray-500">Maximum retailers</Text>
         <View className="mt-2 flex-row gap-2">
            {([1, 2, 3] as const).map((count) => (
               <Pressable key={count} onPress={() => controller.setMaxRetailers(count)} className={`flex-1 items-center rounded-lg border py-2 ${controller.maxRetailers === count ? "border-emerald-500 bg-emerald-50" : "border-gray-200"}`}>
                  <Text className="text-xs font-semibold text-gray-700">{count}</Text>
               </Pressable>
            ))}
         </View>
         <View className="mt-4 flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-xs text-gray-600">Allow store-brand substitutes</Text>
            <Switch value={controller.allowStoreBrandSubstitutions} onValueChange={controller.setAllowStoreBrandSubstitutions} trackColor={{ false: "#D1D5DB", true: "#A7F3D0" }} thumbColor={controller.allowStoreBrandSubstitutions ? "#0DAD79" : "#F9FAFB"} />
         </View>
         <View className="mt-4 flex-row items-center justify-between gap-3 opacity-50">
            <Text className="flex-1 text-xs text-gray-600">Include loyalty prices</Text>
            <Switch disabled value={false} />
         </View>
      </Card>
   );
}

function RetailerComparisonTable({ run }: { run: GroceryComparisonRun }) {
   return (
      <Card className="flex-1 overflow-hidden">
         <SectionHeader title="Basket comparison" subtitle="Partial totals show available items and are never ranked against better coverage." />
         <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="min-w-[720px] flex-1">
               <View className="flex-row bg-gray-50 px-5 py-3">
                  {[["Retailer", 170], ["Available subtotal", 140], ["Coverage", 110], ["Exact", 80], ["Subs", 80], ["Saving", 120]].map(([label, cellWidth]) => (
                     <Text key={String(label)} style={{ width: Number(cellWidth) }} className="text-xs font-semibold text-gray-500">{label}</Text>
                  ))}
               </View>
               {run.retailerResults.map((result) => (
                  <View key={result.retailerId} className={`flex-row items-center border-t border-gray-100 px-5 py-4 ${result.rankEligible ? "bg-emerald-50/50" : ""}`}>
                     <View style={{ width: 170 }}><RetailerBadge name={result.retailerName} /></View>
                     <Text style={{ width: 140 }} className="text-sm font-bold text-gray-900">{formatMoney(result.total)}</Text>
                     <Text style={{ width: 110 }} className="text-xs text-gray-600">{result.coverage.found} / {result.coverage.total}</Text>
                     <Text style={{ width: 80 }} className="text-xs text-gray-600">{result.coverage.found - result.substitutions}</Text>
                     <Text style={{ width: 80 }} className="text-xs text-amber-700">{result.substitutions}</Text>
                     <Text style={{ width: 120 }} className={`text-xs font-semibold ${result.savings ? "text-emerald-700" : "text-gray-500"}`}>{result.savings ? `Save ${formatMoney(result.savings)}` : "No comparable price"}</Text>
                  </View>
               ))}
            </View>
         </ScrollView>
      </Card>
   );
}

function BasketBreakdown({ plan }: { plan: ComparisonPlan }) {
   const groups = useMemo(() => {
      const map = new Map<string, typeof plan.items>();
      plan.items.forEach((item) => map.set(item.retailerName, [...(map.get(item.retailerName) || []), item]));
      return Array.from(map.entries());
   }, [plan]);
   return (
      <Card className="overflow-hidden">
         <SectionHeader title={`Basket breakdown — ${plan.retailers.map((item) => formatRetailerName(item.retailerName)).join(" + ")}`} subtitle="Grouped by retailer" />
         {groups.map(([retailer, items]) => (
            <View key={retailer}>
               <View className="flex-row justify-between bg-gray-50 px-5 py-3">
                  <RetailerBadge name={retailer} />
                  <Text className="text-sm font-bold text-gray-900">{formatMoney({ amount: items.reduce((sum, item) => sum + Number(item.price.amount) * item.quantity, 0).toFixed(2), currency: "AUD" })}</Text>
               </View>
               {items.map((item) => (
                  <View key={item.lineItemId || item.productId} className="flex-row items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
                     <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gray-50">{item.imageUrl ? <Image source={{ uri: item.imageUrl }} className="h-10 w-10" resizeMode="contain" /> : <FontAwesome6 name="image" size={13} color="#CBD5E1" />}</View>
                     <View className="flex-1"><Text className="text-sm text-gray-900">{item.productName}</Text><Text className="mt-1 text-xs text-gray-400">Exact match · qty {item.quantity}</Text></View>
                     <Text className="text-sm font-bold text-gray-900">{formatMoney(item.price)}</Text>
                  </View>
               ))}
            </View>
         ))}
      </Card>
   );
}

function VerifiedSavings({ plan }: { plan: ComparisonPlan }) {
   return (
      <Card className="flex-1 p-5">
         <Text className="text-base font-bold text-gray-900">Where your savings come from</Text>
         <Text className="mt-1 text-xs text-gray-500">Only contributions verified from compatible latest prices are shown.</Text>
         <View className="mt-5 flex-row items-center justify-between"><Text className="text-sm text-gray-600">Cheaper compatible retailer offers</Text><Text className="text-sm font-bold text-gray-900">{formatMoney(plan.savings)}</Text></View>
         <View className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"><View className="h-full w-full rounded-full bg-emerald-500" /></View>
         <View className="mt-5 flex-row justify-between border-t border-gray-100 pt-4"><Text className="text-sm font-bold text-gray-900">Verified saving</Text><Text className="text-xl font-bold text-emerald-700">{formatMoney(plan.savings)}</Text></View>
      </Card>
   );
}

function Suggestions({ run, setRun, setNotice }: { run: GroceryComparisonRun; setRun: (run: GroceryComparisonRun) => void; setNotice: (message: string | null) => void }) {
   const suggestions = run.suggestions || [];
   const apply = async (originalProductId: string, replacementProductId: string) => {
      try {
         const next = await applyComparisonSubstitution(run.id, { originalProductId, replacementProductId });
         setRun(next);
         void trackComparisonEvents([{ name: "substitution_applied", properties: { runId: run.id, replacementProductId } }]);
      } catch (cause) {
         setNotice(cause instanceof Error ? cause.message : "The substitution could not be applied.");
      }
   };
   const dismiss = async (originalProductId: string, replacementProductId: string) => {
      try {
         await dismissComparisonSubstitution(run.id, { originalProductId, replacementProductId });
         setRun({ ...run, suggestions: suggestions.filter((item) => item.replacement.productId !== replacementProductId) });
         void trackComparisonEvents([{ name: "substitution_dismissed", properties: { runId: run.id, replacementProductId } }]);
      } catch (cause) {
         setNotice(cause instanceof Error ? cause.message : "The suggestion could not be dismissed.");
      }
   };
   return (
      <Card className="flex-1 p-5">
         <Text className="text-base font-bold text-gray-900">Ways to save more</Text>
         {suggestions.length ? <View className="mt-4 gap-3">{suggestions.map((item) => (
            <View key={item.id} className="rounded-lg border border-gray-200 p-3">
               <View className="flex-row gap-3"><FontAwesome6 name="arrow-up" size={12} color="#0DAD79" /><Text className="flex-1 text-sm text-gray-700">Replace {item.originalProductName} with {item.replacement.name}. {item.reason}</Text><Text className="text-sm font-bold text-emerald-700">{formatMoney(item.estimatedSaving)}</Text></View>
               <View className="mt-3 flex-row justify-end gap-2"><ActionButton compact label="Dismiss" onPress={() => void dismiss(item.originalProductId, item.replacement.productId)} /><ActionButton compact primary label="Apply" onPress={() => void apply(item.originalProductId, item.replacement.productId)} /></View>
            </View>
         ))}</View> : <Text className="mt-4 text-sm text-gray-500">No verified lower-cost substitutions are available right now.</Text>}
      </Card>
   );
}
