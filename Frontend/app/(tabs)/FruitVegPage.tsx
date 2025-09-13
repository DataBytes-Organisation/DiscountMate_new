import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/FontAwesome';
import ProductCard from '@/components/ProductCard';
import { Product } from '@/types/product';
import { useBasket } from './BasketContext';

// Use same base detection pattern used elsewhere in your app
const API_BASE =
  (typeof process !== 'undefined' && (process as any)?.env?.EXPO_PUBLIC_API_BASE) ||
  (typeof window !== 'undefined' && (window as any)?.location?.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'http://localhost:3000');

// Accept a variety of DB category spellings
const CATEGORY_LABEL = 'Fruit & Veg';
const CATEGORY_MATCHERS = [
  'fruit & veg',
  'fruit and veg',
  'fruit & vegetables',
  'fruit and vegetables',
  'fruits & vegetables',
  'fruits and vegetables',
  'fruit',
  'vegetable',
  'fresh produce',
];

function normalize(s: unknown) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/vegetables?/g, 'veg')
    .replace(/[^a-z0-9\s>/|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoryMatches(rawCategory: unknown): boolean {
  const c = normalize(rawCategory);
  if (!c) return false;
  // Handle hierarchical strings like "Fruit & Veg > Fresh Fruit"
  const tokens = c.split(/[>/|,-]/).map(t => t.trim()).filter(Boolean);
  const hay = new Set([c, ...tokens]);
  return CATEGORY_MATCHERS.some(m => hay.has(normalize(m)) || c.includes(normalize(m)));
}

type ApiDoc = {
  _id?: string;
  product_id?: string | number;
  product_code?: string;
  product_name?: string;
  name?: string;
  link_image?: string;
  image?: string;
  current_price?: number | string;
  price?: number | string;
  category?: string | string[];
  Category?: string | string[];
};

export default function FruitVegPage() {
  const router = useRouter();
  const { addToBasket, getBasket } = useBasket();

  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addingIds, setAddingIds] = useState<Record<string, true>>({});
  const [addedIds, setAddedIds] = useState<Record<string, true>>({});

  const handleAdd = async (p: Product) => {
    const id = String((p as any).id ?? (p as any)._id ?? (p as any).product_id ?? '');
    if (!id || addingIds[id]) return;

    const price =
      (typeof (p as any).discountPrice === 'number' ? (p as any).discountPrice : undefined)
        ?? (p as any).price ?? 0;

    setAddingIds(prev => ({ ...prev, [id]: true }));
    const ok = await addToBasket({
      product_id: id,  // ✅ DB id
      quantity: 1,
      name: (p as any).name,
      price,
      image: (p as any).image || '',
    });
    setAddingIds(prev => { const c = { ...prev }; delete c[id]; return c; });
    if (ok) {
      setAddedIds(prev => ({ ...prev, [id]: true }));
      setTimeout(() => getBasket(), 100);
    } else {
      Alert.alert('Add failed', 'Could not add this item to your basket.');
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const r = await fetch(`${API_BASE}/api/products`);
        if (!r.ok) throw new Error(`Products fetch failed (${r.status})`);
        const data: ApiDoc[] = await r.json();

        const mapped: Product[] = (Array.isArray(data) ? data : []).map((it) => {
          const id = String(it._id ?? it.product_id ?? it.product_code ?? '');
          const name = String(it.product_name ?? it.name ?? 'Unnamed');
          const image = String(it.link_image ?? it.image ?? '');
          const priceNum = Number(it.current_price ?? it.price ?? 0);
          const categoryVal = (it.category ?? it.Category) as any;

          return {
            id,
            name,
            image,
            price: priceNum,
            originalPrice: priceNum,
            discountPrice: priceNum,
            unit: '',
            description: '',
            nutritionalInfo: { calories: 0, protein: '', fat: '', carbs: '', sugar: '' },
            stock: 0,
            rating: 0,
            reviews: 0,
            isOrganic: false,
            isFeatured: false,
            tags: [],
            relatedProducts: [],
            category: categoryVal,
            productCode: String(it.product_code ?? ''),
          } as unknown as Product;
        }).filter((p: any) => !!p.id);

        // Filter to Fruit & Veg (robust)
        const fruitVegOnly = mapped.filter((p: any) => {
          const cat = (p as any).category;
          if (Array.isArray(cat)) return cat.some(categoryMatches);
          return categoryMatches(cat);
        });

        // De-dupe by id
        const seen = new Set<string>();
        const unique = fruitVegOnly.filter((p: any) => {
          const key = String(p.id);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setRows(unique);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Failed to load items.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const sorted = useMemo(() => {
    // keep as-is; add custom sorts if needed
    return rows;
  }, [rows]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.mainContent}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.navigation}>
              <Pressable style={styles.backButton} onPress={() => router.push('/')}>
                <Icon name="chevron-left" size={16} color="#666" />
                <Text style={styles.backText}>Back to Home</Text>
              </Pressable>
            </View>

            <Stack.Screen options={{ title: CATEGORY_LABEL }} />

            {loading && <Text style={styles.loadingText}>Loading…</Text>}
            {error && <Text style={styles.errorText}>{error}</Text>}

            {!loading && !error && sorted.length === 0 && (
              <View style={styles.emptyState}>
                <Icon name="info-circle" size={24} color="#5a9ea6" />
                <Text style={styles.emptyStateText}>No Fruit & Veg items found.</Text>
                <Pressable style={styles.browseButton} onPress={() => router.push('/(tabs)/productpage')}>
                  <Text style={styles.browseButtonText}>Browse all products</Text>
                </Pressable>
              </View>
            )}

            <View style={[styles.productsGrid, Platform.OS === 'web' && styles.webProductWrapper]}>
              {sorted.map((p: any) => {
                const id = String(p.id);
                return (
                  <View key={id} style={[styles.productWrapper, Platform.OS === 'web' && styles.webProductWrapper]}>
                    <ProductCard
                      product={p}
                      onAddToBasket={() => handleAdd(p)}
                      inBasket={!!(addedIds[id] || addingIds[id])}
                      adding={!!addingIds[id]}
                    />
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, flexDirection: 'row' },
  mainContent: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  navigation: { marginBottom: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  backText: { marginLeft: 4, fontSize: 14, color: '#666' },
  loadingText: { fontSize: 16, color: '#666', marginBottom: 16 },
  errorText: { fontSize: 16, color: '#e74c3c', marginBottom: 16 },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  productWrapper: { width: '48%', marginBottom: 16 },
  webProductWrapper: { width: '31%' },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyStateText: { fontSize: 16, color: '#666', marginBottom: 16, textAlign: 'center' },
  browseButton: { backgroundColor: '#5a9ea6', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 4 },
  browseButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
});
