import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/FontAwesome';
import CartBadge from '@/components/CartBadge';
import { useBasket } from '../BasketContext';

const API_BASE =
  (typeof process !== 'undefined' && (process as any)?.env?.EXPO_PUBLIC_API_BASE) ||
  (typeof window !== 'undefined' && (window as any)?.location?.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'http://localhost:3000');

type ApiProductDetail = {
  product_id?: string | number;
  product_name?: string;
  link_image?: string;
  current_price?: number | string;
};

function getStableId(p: ApiProductDetail | null, fallback: string | undefined) {
  return String(p?.product_id ?? fallback ?? '');
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addToBasket, getBasket, basketData } = useBasket() as any;

  const [product, setProduct] = useState<ApiProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(`${API_BASE}/api/products/getproduct`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: id }), // IMPORTANT: send productId
        });
        if (!r.ok) throw new Error(`Fetch failed (${r.status})`);
        const data: ApiProductDetail = await r.json();
        setProduct(data);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Failed to load product.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const onAdd = async () => {
    if (!product) return;
    try {
      setAdding(true);
      const pid = getStableId(product, id);
      const price = Number(product.current_price ?? 0);
      const ok = await addToBasket({
        product_id: pid,
        quantity: 1,
        name: product.product_name ?? 'Unnamed',
        price,
        image: product.link_image || '',
      });
      if (ok) setTimeout(() => getBasket(), 100);
      else Alert.alert('Add failed', 'Could not add this item to your basket.');
    } finally {
      setAdding(false);
    }
  };

  const basketQty = useMemo(() => {
    if (!Array.isArray(basketData)) return 0;
    const sum = basketData.reduce((s: number, it: any) => s + Number(it.quantity || 0), 0);
    return sum || basketData.length || 0;
  }, [basketData]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Product',
            headerRight: () => <CartBadge />, // reads from context if no count passed
          }}
        />
        <View style={styles.content}>
          <Text style={styles.infoText}>Loading…</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Product',
            headerRight: () => <CartBadge count={basketQty} />,
          }}
        />
        <View style={styles.content}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Product',
            headerRight: () => <CartBadge count={basketQty} />,
          }}
        />
        <View style={styles.content}>
          <Text style={styles.infoText}>Product not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: product?.product_name ?? 'Product',
          headerRight: () => <CartBadge count={basketQty} />,
        }}
      />
      <View style={styles.card}>
        <Text style={styles.title}>{product.product_name}</Text>
        <Text style={styles.price}>${Number(product.current_price ?? 0).toFixed(2)}</Text>

        <Pressable style={styles.addBtn} onPress={onAdd} disabled={adding}>
          <Icon name="shopping-basket" size={16} color="#fff" />
          <Text style={styles.addTxt}>{adding ? 'Adding…' : 'Add to Basket'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  content: { padding: 16 },
  infoText: { fontSize: 16, color: '#666' },
  errorContainer: { alignItems: 'center', gap: 12 },
  errorText: { color: '#e74c3c' },
  backButton: { backgroundColor: '#5a9ea6', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6 },
  backButtonText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, gap: 8, elevation: 1 },
  title: { fontWeight: '700', fontSize: 18 },
  price: { fontWeight: '600', fontSize: 16 },
  addBtn: { marginTop: 8, backgroundColor: '#5a9ea6', paddingVertical: 12, borderRadius: 6, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  addTxt: { color: '#fff', fontWeight: '700' },
});
