import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useRouter } from 'expo-router';

// IMPORTANT: point to the SAME context file your tab pages use.
// If your BasketContext lives elsewhere, adjust this path accordingly.
import { useBasket } from '@/app/(tabs)/BasketContext';

type Props = {
  /** Optional override. If omitted, the badge computes from BasketContext. */
  count?: number;
  /** Optional route to navigate when pressed. */
  to?: string;
};

export default function CartBadge({ count, to = '/(tabs)/mybasket' }: Props) {
  const router = useRouter();
  const ctx = (useBasket?.() as any) || {};

  // If `count` isn't provided, compute from context so it works on the basket page too.
  const computed = useMemo(() => {
    const arr = Array.isArray(ctx.basketData) ? ctx.basketData : [];
    const sum = arr.reduce((s: number, it: any) => s + Number(it.quantity || 0), 0);
    return sum || arr.length || 0;
  }, [ctx.basketData]);

  const qty = typeof count === 'number' ? count : computed;

  const go = () => {
    try {
      router.push(to);
    } catch {
      // fallback if your route name differs
      try { router.push('/mybasket'); } catch {}
    }
  };

  return (
    <Pressable onPress={go} style={styles.wrap} hitSlop={10}>
      <Icon name="shopping-basket" size={22} color="#333" />
      {qty > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{qty > 99 ? '99+' : qty}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingVertical: 4 },
  badge: {
    position: 'absolute',
    right: 2,
    top: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
