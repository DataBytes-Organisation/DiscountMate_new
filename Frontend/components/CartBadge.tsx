import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import { useBasket } from '@/app/(tabs)/BasketContext';

type Props = {
  /** Where to navigate when pressed */
  to?: string;
  /** Layout tuning (header vs sidebar positions) */
  variant?: 'header' | 'sidebar';
  /** Optional override color/size to match your theme exactly */
  color?: string;
  size?: number;
};

export default function CartBadge({
  to = '/basketsummary',
  variant = 'header',
  color = '#000',
  size,
}: Props) {
  const router = useRouter();
  const { basketData } = (useBasket?.() as any) ?? { basketData: [] };

  const qty = useMemo(() => {
    if (!Array.isArray(basketData)) return 0;
    const sum = basketData.reduce((s: number, it: any) => s + Number(it?.quantity || 0), 0);
    return sum || basketData.length || 0;
  }, [basketData]);

  const go = () => {
    try { router.push(to); } catch { /* no-op */ }
  };

  const isSidebar = variant === 'sidebar';
  const iconSize = size ?? (isSidebar ? 24 : 22);

  return (
    <Pressable onPress={go} style={[styles.wrap, isSidebar && styles.sidebarWrap]} hitSlop={10}>
      {/* Use the same icon family your app already uses everywhere */}
      <TabBarIcon name="basket-outline" color={color} size={iconSize} />
      {qty > 0 && (
        <View style={[styles.badge, isSidebar ? styles.badgeSidebar : styles.badgeHeader]}>
          <Text style={styles.badgeText}>{qty > 99 ? '99+' : qty}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 6, paddingVertical: 4 },
  sidebarWrap: { paddingHorizontal: 0, paddingVertical: 0 },

  badge: {
    position: 'absolute',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  // tuned for your top header icon area
  badgeHeader: {
    right: -6,
    top: -3,
  },
  // tuned for the left sidebar icon area
  badgeSidebar: {
    right: -8,
    top: -6,
  },

  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
