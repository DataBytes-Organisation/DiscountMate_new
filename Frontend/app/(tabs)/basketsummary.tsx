import React, { useEffect, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert } from 'react-native';
import BasketSummaryItem from './basketsummaryitem';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSegments } from 'expo-router';
import { useBasket } from './BasketContext';

interface Basket {
  basketItemId: number;
  price: number;
  productId: string | number;
  productCode?: string | number;
  image: string;
  name: string;
  shortDescription: string;
  quantity: number;
}

const API_BASE =
  (typeof process !== 'undefined' && (process as any)?.env?.EXPO_PUBLIC_API_BASE) ||
  (typeof window !== 'undefined' && (window as any)?.location?.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'http://localhost:3000');

export default function BasketSummary() {
  //Use global basket — this drives the header/sidebar cart bubble
  const { basketData, getBasket } = useBasket() as unknown as { basketData: Basket[]; getBasket: () => Promise<void> };
  const segments = useSegments();

  // Ensure we’re always showing the latest server state (and keep the bubble in sync)
  useEffect(() => {
    getBasket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  // -------- API helpers (keep your existing endpoints) --------
  const authHeaders = async () => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) throw new Error('No auth token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const updateQuantity = async (productId: string | number, quantity: number) => {
    try {
      const headers = await authHeaders();
      const url = `${API_BASE}/api/baskets/updatequantity`;
      const body = JSON.stringify({ productId, quantity });
      const res = await fetch(url, { method: 'POST', headers, body });
      if (!res.ok) throw new Error(`updatequantity ${res.status}`);
      // After mutation, refresh the global context so the bubble updates immediately
      await getBasket();
      return true;
    } catch (e) {
      console.error('updateQuantity error:', e);
      return false;
    }
  };

  const deleteItemFromBasket = async (productId: string | number) => {
    try {
      const headers = await authHeaders();
      const url = `${API_BASE}/api/baskets/deleteitemfrombasket`;
      const body = JSON.stringify({ productId });
      const res = await fetch(url, { method: 'DELETE', headers, body });
      if (!res.ok) throw new Error(`deleteitem ${res.status}`);
      // Refresh global basket for live bubble update
      await getBasket();
      return true;
    } catch (e) {
      console.error('deleteItemFromBasket error:', e);
      return false;
    }
  };

  // -------- UI actions wired to server + global refresh --------
  const addToBasket = async (productId: string | number) => {
    const row = (basketData || []).find((it) => String(it.productId) === String(productId));
    const next = (row?.quantity ?? 0) + 1;
    const ok = await updateQuantity(productId, next);
    if (!ok) Alert.alert('Update failed', 'Could not increase quantity.');
  };

  const removeFromBasket = async (productId: string | number) => {
    const row = (basketData || []).find((it) => String(it.productId) === String(productId));
    const current = row?.quantity ?? 1;
    const next = Math.max(1, current - 1); // keep >= 1; use delete for full removal
    const ok = await updateQuantity(productId, next);
    if (!ok) Alert.alert('Update failed', 'Could not decrease quantity.');
  };

  const hardDelete = async (productId: string | number) => {
    const ok = await deleteItemFromBasket(productId);
    if (!ok) Alert.alert('Remove failed', 'Could not remove item from basket.');
  };

  // -------- totals --------
  const total = useMemo(
    () => (basketData || []).reduce((sum, r) => sum + Number(r.price || 0) * Number(r.quantity || 0), 0),
    [basketData]
  );

  const formattedCurrency = (price: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(price);

  const items = Array.isArray(basketData) ? basketData : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <View style={[styles.row, styles.my2]}>
        <View style={[styles.col, { alignItems: 'center' }]}>
          <Text style={[styles.h3, styles.textDark, styles.ml3]}>My Basket</Text>
        </View>
      </View>

      <View style={[styles.row, styles.mxAuto]}>
        {total > 0 ? (
          <View style={[styles.col, styles.alignItemsStretch]}>
            {items.map((item, index) => (
              <View key={String(item.productId ?? index)} style={{ marginBottom: 12 }}>
                <BasketSummaryItem
                  productId={item.productId}
                  name={item.name}
                  price={item.price}
                  image={item.image}
                  shortDescription={item.shortDescription}
                  quantity={item.quantity}
                  basketItemId={item.basketItemId}
                  addToBasket={addToBasket}                 // +1
                  removeFromBasket={removeFromBasket}       // -1 (min 1)
                  deleteItemFromBasket={hardDelete}         // remove row
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.col, styles.my5]}>
            <Text style={[styles.h3, styles.textCenter]}>Your basket is empty!</Text>
          </View>
        )}
      </View>

      <View style={styles.hr} />

      <View style={[styles.row, styles.my2]}>
        <View style={[styles.col, styles.textLeft, styles.ml3, styles.myAuto]}>
          <Text style={[styles.h4, styles.textDark, { fontWeight: 'bold' }]}>
            Basket Total: {total > 0 ? formattedCurrency(total) : ''}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F8FAFC' },
  inner: { padding: 16, paddingBottom: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  col: { flex: 1 },
  my2: { marginVertical: 10 },
  my5: { marginVertical: 50 },
  ml3: { marginLeft: 10 },
  mr3: { marginRight: 10 },
  mxAuto: { marginHorizontal: 'auto' as any },
  textRight: { alignItems: 'flex-end' },
  textLeft: { alignItems: 'flex-start' },
  textCenter: { textAlign: 'center' },
  textDark: { color: '#000' },
  h3: { fontSize: 20, fontWeight: 'bold' },
  h4: { fontSize: 18 },
  hr: { borderBottomColor: '#E5E7EB', borderBottomWidth: 1, marginVertical: 12 },
  myAuto: { marginVertical: 'auto' as any },
  alignItemsStretch: { alignItems: 'stretch' },
});
