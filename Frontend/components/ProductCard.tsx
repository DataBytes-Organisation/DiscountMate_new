import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types/product';

// Optional BasketContext (works without it too)
let useBasket: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  useBasket = require('../context/BasketContext').useBasket;
} catch { useBasket = undefined; }

const BASE_URL = (process.env.EXPO_PUBLIC_BASE_URL as string) || 'http://localhost:3000';

/** ---- Shared basket cache to prevent many fetches ---- */
type BasketItem = { productId: string; productCode?: string | null; name?: string; price?: number | string };

let basketCache: { items: BasketItem[]; fetchedAt: number } | null = null;
let basketFetchPromise: Promise<BasketItem[]> | null = null;
const CACHE_TTL_MS = 15000;
const now = () => Date.now();

async function fetchBasketOnce(): Promise<BasketItem[]> {
  if (basketCache && now() - basketCache.fetchedAt < CACHE_TTL_MS) return basketCache.items;
  if (basketFetchPromise) return basketFetchPromise;

  basketFetchPromise = (async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return [];
      const r = await fetch(`${BASE_URL}/api/baskets/getbasket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return [];
      const data = (await r.json()) as BasketItem[];
      basketCache = { items: data || [], fetchedAt: now() };
      return basketCache.items;
    } catch {
      return [];
    } finally {
      basketFetchPromise = null;
    }
  })();

  return basketFetchPromise;
}

function invalidateBasketCache() {
  basketCache = null;
  basketFetchPromise = null;
}

/** ---------------- Component ---------------- */
interface ProductCardProps {
  product: Product;
  showActions?: boolean;
  onAddToBasket?: () => void; // optional
  inBasket?: boolean;          // optional
  adding?: boolean;            // optional
}

export default function ProductCard({
  product,
  showActions = true,
  onAddToBasket,
  inBasket = false,
  adding = false,
}: ProductCardProps) {
  const router = useRouter();
  const basketCtx = useBasket ? useBasket() : undefined;

  const [localInBasket, setLocalInBasket] = useState(false);
  const [localAdding, setLocalAdding] = useState(false);
  const [loadingBasket, setLoadingBasket] = useState(false);
  const primed = useRef(false);

  // Prefer Mongo _id when available (Home)
  const canonicalId = useMemo(() => {
    const anyId =
      (product as any)?._id ??
      (product as any)?.id ??
      (product as any)?.productId ??
      (product as any)?.product_id;
    return anyId != null ? String(anyId) : undefined;
  }, [product]);

  // For Category/CSV products
  const productCode = useMemo(() => {
    const code = (product as any)?.productCode ?? (product as any)?.product_code;
    return code != null ? String(code).trim().toLowerCase() : undefined;
  }, [product]);

  const matchKey = useMemo(() => {
    const nm = String((product as any)?.name || '').trim().toLowerCase();
    const pr = Number((product as any)?.price ?? 0);
    return `${nm}|${pr.toFixed(2)}`;
  }, [product]);

  // Compute “in basket”: parent → context → local cache
  const effectiveInBasket = useMemo(() => {
    if (inBasket) return true;

    const basketArr = basketCtx?.basket || basketCache?.items || [];
    if (basketArr.length) {
      if (canonicalId && basketArr.some((it: any) => String(it.productId) === canonicalId)) return true;

      if (productCode) {
        const foundByCode = basketArr.some((it: any) => {
          const bc = (it.productCode ?? it.product_code ?? '').toString().trim().toLowerCase();
          return bc && bc === productCode;
        });
        if (foundByCode) return true;
      }

      // Final fallback: name+price (handles some CSV cases)
      const foundByKey = basketArr.some((it: any) => {
        const nm = String(it.name || '').trim().toLowerCase();
        const pr = Number(it.price ?? 0);
        return `${nm}|${pr.toFixed(2)}` === matchKey;
        });
      if (foundByKey) return true;
    }

    return localInBasket;
  }, [inBasket, basketCtx?.basket, canonicalId, productCode, matchKey]);

  const effectiveAdding = adding || localAdding;

  // Prime once from context or cache
  useEffect(() => {
    if (inBasket || primed.current) return;

    const prime = async () => {
      if (basketCtx?.basket) {
        // Already in memory
        const present = canonicalId
          ? basketCtx.basket.some((it: any) => String(it.productId) === canonicalId)
          : productCode
          ? basketCtx.basket.some((it: any) => {
              const bc = (it.productCode ?? it.product_code ?? '').toString().trim().toLowerCase();
              return bc && bc === productCode;
            })
          : basketCtx.basket.some((it: any) => {
              const nm = String(it.name || '').trim().toLowerCase();
              const pr = Number(it.price ?? 0);
              return `${nm}|${pr.toFixed(2)}` === matchKey;
            });
        setLocalInBasket(present);
        primed.current = true;
        return;
      }

      setLoadingBasket(true);
      const items = await fetchBasketOnce();
      const present = canonicalId
        ? items.some((it: any) => String(it.productId) === canonicalId)
        : productCode
        ? items.some((it: any) => {
            const bc = (it.productCode ?? it.product_code ?? '').toString().trim().toLowerCase();
            return bc && bc === productCode;
          })
        : items.some((it: any) => {
            const nm = String(it.name || '').trim().toLowerCase();
            const pr = Number(it.price ?? 0);
            return `${nm}|${pr.toFixed(2)}` === matchKey;
          });
      setLocalInBasket(present);
      setLoadingBasket(false);
      primed.current = true;
    };

    prime();
  }, [inBasket, basketCtx?.basket, canonicalId, productCode, matchKey]);

  const navigateToProduct = () => {
    router.push(`/product/${(product as any)?.id}`);
  };

  const originalPrice = (product as any)?.originalPrice ?? (product as any)?.price ?? 0;
  const discountedPrice = (product as any)?.discountPrice ?? (product as any)?.price ?? 0;
  const showDiscount = Number(discountedPrice) < Number(originalPrice);

  const addText = effectiveAdding ? 'Adding…' : effectiveInBasket ? 'In Basket' : 'Add To Basket';

  const handleAdd = async () => {
    if (effectiveInBasket || effectiveAdding) return;

    // Parent handler
    if (typeof onAddToBasket === 'function') {
      try {
        setLocalAdding(true);
        await onAddToBasket();
        setLocalInBasket(true);
        invalidateBasketCache();
      } finally {
        setLocalAdding(false);
      }
      return;
    }

    // Context path
    if (basketCtx?.addToBasket) {
      try {
        setLocalAdding(true);
        await basketCtx.addToBasket({
          product_id: canonicalId,                       // Home path
          product_code: (product as any)?.productCode,   // Category path
          quantity: 1,
        });
        setLocalInBasket(true);
        invalidateBasketCache();
      } finally {
        setLocalAdding(false);
      }
      return;
    }

    // Direct API fallback
    try {
      setLocalAdding(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      await fetch(`${BASE_URL}/api/baskets/addtobasket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          product_id: canonicalId,
          product_code: (product as any)?.productCode,
          quantity: 1,
          name: (product as any)?.name,
          price: Number((product as any)?.price ?? 0),
          image: (product as any)?.image,
        }),
      });

      setLocalInBasket(true);
      invalidateBasketCache();
    } finally {
      setLocalAdding(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.imageContainer} onPress={navigateToProduct}>
        <Image source={{ uri: (product as any)?.image || '' }} style={styles.image} resizeMode="cover" />
      </Pressable>

      <View style={styles.infoContainer}>
        <Pressable onPress={navigateToProduct}>
          <Text style={styles.name}>{(product as any)?.name}</Text>
        </Pressable>

        <Text style={styles.subcategory}>Category: {(product as any)?.category}</Text>
        {!!(product as any)?.productCode && (
          <Text style={styles.productCode}>Product Code: {(product as any)?.productCode}</Text>
        )}

        <View style={styles.priceContainer}>
          {showDiscount ? (
            <>
              <Text style={styles.discountPrice}>${Number(discountedPrice || 0).toFixed(2)}</Text>
              <Text style={styles.originalPrice}>${Number(originalPrice || 0).toFixed(2)}</Text>
            </>
          ) : (
            <Text style={styles.price}>${Number((product as any)?.price || 0).toFixed(2)}</Text>
          )}
        </View>

        {showActions && (
          <View style={styles.actionsContainer}>
            <Pressable style={styles.heartButton}>
              <Icon name="heart" size={24} color="#5a9ea6" />
            </Pressable>

            <View style={styles.buttonsContainer}>
              {loadingBasket ? (
                <View style={[styles.addToBasketButton, styles.addDisabled]}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : (
                <Pressable
                  style={[styles.addToBasketButton, (effectiveInBasket || effectiveAdding) && styles.addDisabled]}
                  onPress={handleAdd}
                  disabled={effectiveInBasket || effectiveAdding}
                >
                  <Text style={styles.buttonText}>{addText}</Text>
                </Pressable>
              )}

              <Pressable style={styles.buyNowButton} onPress={navigateToProduct}>
                <Text style={styles.buttonText}>Buy Now</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#f8f9fa', borderRadius: 8, overflow: 'hidden', marginBottom: 16, width: '100%' },
  imageContainer: { height: 200, width: '100%', backgroundColor: '#fff' },
  image: { height: '100%', width: '100%' },
  infoContainer: { padding: 12 },
  name: { fontSize: 16, fontWeight: '600', marginBottom: 4, color: '#333' },
  subcategory: { fontSize: 14, color: '#666', marginBottom: 4 },
  productCode: { fontSize: 12, color: '#999', marginBottom: 8 },
  priceContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  price: { fontSize: 18, fontWeight: '700', color: '#e74c3c' },
  discountPrice: { fontSize: 18, fontWeight: '700', color: '#e74c3c', marginRight: 8 },
  originalPrice: { fontSize: 14, color: '#999', textDecorationLine: 'line-through' },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heartButton: { padding: 8, borderRadius: 4 },
  buttonsContainer: { flexDirection: 'row', gap: 8 },
  addToBasketButton: { backgroundColor: '#5a9ea6', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 4 },
  addDisabled: { backgroundColor: '#c0cfd3' },
  buyNowButton: { backgroundColor: '#5a9ea6', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 4 },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 12 },
});
