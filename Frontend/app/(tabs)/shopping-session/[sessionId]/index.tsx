import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import FooterSection from "../../../../components/home/FooterSection";
import { ErrorState, LoadingState } from "../../../../features/comparison/ComparisonPrimitives";
import { ShoppingSessionView } from "../../../../features/comparison/ShoppingSessionView";
import { fetchShoppingSession, trackComparisonEvents, updateShoppingSessionItem } from "../../../../services/comparisons";
import type { ShoppingSession, ShoppingSessionItem } from "../../../../types/Comparison";

export default function ShoppingSessionPage() {
   const params = useLocalSearchParams<{ sessionId: string }>();
   const sessionId = String(params.sessionId || "");
   const [session, setSession] = useState<ShoppingSession | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [loading, setLoading] = useState(true);

   const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
         const next = await fetchShoppingSession(sessionId);
         setSession(next);
         void trackComparisonEvents([{ name: "shopping_session_viewed", properties: { sessionId } }]);
      } catch (cause) {
         setError(cause instanceof Error ? cause.message : "Shopping Mode is unavailable.");
      } finally {
         setLoading(false);
      }
   }, [sessionId]);

   useEffect(() => { if (sessionId) void load(); }, [load, sessionId]);

   const toggle = async (item: ShoppingSessionItem, checked: boolean) => {
      if (!session) return;
      const previous = session;
      setSession({
         ...session,
         groups: session.groups.map((group) => ({
            ...group,
            items: group.items.map((candidate) => candidate.lineItemId === item.lineItemId ? { ...candidate, checked } : candidate),
         })),
      });
      try {
         const saved = await updateShoppingSessionItem(session.id, item.lineItemId || item.productId, checked);
         setSession(saved);
         void trackComparisonEvents([{ name: "shopping_item_checked", properties: { sessionId: session.id, itemId: item.lineItemId, checked } }]);
         if (checked) void trackComparisonEvents([{ name: "shopping_item_completed", properties: { sessionId: session.id, itemId: item.lineItemId } }]);
         if (saved.groups.flatMap((group) => group.items).every((candidate) => candidate.checked)) {
            void trackComparisonEvents([{ name: "shopping_session_completed", properties: { sessionId: session.id } }]);
         }
      } catch (cause) {
         setSession(previous);
         setError(cause instanceof Error ? cause.message : "Checklist progress could not be saved.");
      }
   };

   return (
      <ScrollView className="flex-1 bg-[#F7F8FA]" contentContainerStyle={{ paddingBottom: 0 }}>
         <View className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-7">
            {loading && !session ? <LoadingState label="Preparing your shopping checklist…" /> : null}
            {error && !session ? <ErrorState message={error} onRetry={() => void load()} /> : null}
            {error && session ? <Text className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</Text> : null}
            {session ? <ShoppingSessionView
               session={session}
               onToggle={toggle}
               onOpenRetailer={(item) => void trackComparisonEvents([{ name: "retailer_product_opened", properties: { sessionId: session.id, retailerId: item.retailerId, productId: item.productId } }])}
               onLinkFailed={(item) => void trackComparisonEvents([{ name: "retailer_link_failed", properties: { sessionId: session.id, retailerId: item.retailerId, productId: item.productId } }])}
            /> : null}
         </View>
         <FooterSection disableEdgeOffset />
      </ScrollView>
   );
}
