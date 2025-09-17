import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable, Alert, FlatList, useWindowDimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/FontAwesome';
import ProductCard from '@/components/ProductCard';
import { Product } from '@/types/product';
import { useBasket } from './BasketContext';

type SortKey = 'featured' | 'priceAsc' | 'priceDesc' | 'nameAsc';

const API_BASE =
  (typeof process !== 'undefined' && (process as any)?.env?.EXPO_PUBLIC_API_BASE) ||
  (typeof window !== 'undefined' && (window as any)?.location?.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'http://localhost:3000');

const PAGE_LIMIT = 500;

function getStableId(rec: any): string {
  return String(
    rec?.productCode ??
    rec?.product_code ??
    rec?.id ??
    rec?._id ??
    rec?.product_id ??
    rec?.productId ??
    ''
  );
}

export default function ProductPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { addToBasket, basketData } = useBasket() as any;

  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('featured');
  const [addingIds, setAddingIds] = useState<Record<string, true>>({});

  const numColumns = useMemo(() => {
    if (width >= 1500) return 5;
    if (width >= 1200) return 4;
    if (width >= 900)  return 3;
    if (width >= 600)  return 2;
    return 1;
  }, [width]);

  const itemWidth = `${100 / numColumns}%`;

  const handleAdd = async (product: Product) => {
    const sid = getStableId(product);
    if (!sid || addingIds[sid]) return;

    const price =
      (typeof (product as any).discountPrice === 'number'
        ? (product as any).discountPrice
        : undefined) ?? (product as any).price ?? 0;

    setAddingIds(prev => ({ ...prev, [sid]: true }));
    const ok = await addToBasket({
      product_id: sid,
      product_code: (product as any).productCode ?? (product as any).product_code ?? sid,
      quantity: 1,
      name: (product as any).name,
      price,
      image: (product as any).image || '',
    });
    setAddingIds(prev => { const c = { ...prev }; delete c[sid]; return c; });
    if (!ok) Alert.alert('Add failed', 'Could not add this item to your basket.');
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(`${API_BASE}/api/products?sources=DiscountMate.product,CleanedData.Coles&limit=${PAGE_LIMIT}`);
        if (!r.ok) throw new Error(`Products fetch failed (${r.status})`);
        const data = await r.json();

        const mapped: Product[] = (Array.isArray(data) ? data : []).map((it: any) => {
          const id = String(it.product_code ?? it._id ?? it.product_id ?? it.productId ?? '');
          const name = String(it.product_name ?? it.name ?? it.item_name ?? 'Unnamed');
          const image = String(it.link_image ?? it.image ?? it.link ?? '');
          const price = Number(it.current_price ?? it.price ?? it.item_price ?? it.best_price ?? 0);
          const category = String(it.category ?? it.Category ?? '');
          const productCode = String(it.product_code ?? it.productCode ?? '');
          return {
            id, name, image, price,
            originalPrice: price, discountPrice: price,
            unit: '', description: '',
            nutritionalInfo: { calories: 0, protein: '', fat: '', carbs: '', sugar: '' },
            stock: 0, rating: 0, reviews: 0, isOrganic: false, isFeatured: false,
            tags: [], relatedProducts: [],
            category: category as any,
            productCode: productCode as any,
          } as unknown as Product;
        }).filter((p: any) => !!getStableId(p));

        const seen = new Set<string>();
        const unique = mapped.filter((p: any) => {
          const key = getStableId(p);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setRows(unique);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Failed to load products.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const basketIdSet = useMemo(
    () => new Set((basketData || []).map((it: any) => String(it.productId || ''))),
    [basketData]
  );
  const basketCodeSet = useMemo(
    () => new Set((basketData || []).map((it: any) => String(it.productCode || '').toLowerCase())),
    [basketData]
  );

  const sorted = useMemo(() => {
    const arr = [...rows];
    switch (sort) {
      case 'priceAsc':  return arr.sort((a: any, b: any) => (a.price ?? 0) - (b.price ?? 0));
      case 'priceDesc': return arr.sort((a: any, b: any) => (b.price ?? 0) - (a.price ?? 0));
      case 'nameAsc':   return arr.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
      default:          return arr;
    }
  }, [rows, sort]);

  return (
    <View style={styles.container}>
      {/* 🔧 Hide native header so you don't get a duplicate top bar */}
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.push('/')}>
          <Icon name="chevron-left" size={16} color="#666" />
          <Text style={styles.backText}>Back to Home</Text>
        </Pressable>

        <View style={styles.pillsRow}>
          {(['featured','priceAsc','priceDesc','nameAsc'] as SortKey[]).map(key => (
            <Pressable
              key={key}
              style={[styles.sortPill, sort === key && styles.sortPillActive]}
              onPress={() => setSort(key)}
            >
              <Text style={[styles.sortText, sort !== key && { color: '#111' }]}>
                {key === 'featured' ? 'Featured' :
                 key === 'priceAsc' ? 'Price ↑' :
                 key === 'priceDesc' ? 'Price ↓' : 'Name A–Z'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading && <Text style={styles.loadingText}>Loading…</Text>}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {!loading && !error && sorted.length > 0 && (
        <FlatList
          key={numColumns}
          data={sorted}
          numColumns={numColumns}
          keyExtractor={(item: any) => getStableId(item)}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={numColumns > 1 ? styles.columnWrap : undefined}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          renderItem={({ item }: { item: any }) => {
            const sid = getStableId(item);
            const code = String((item as any).productCode ?? (item as any).product_code ?? '').toLowerCase();
            const inBasket = basketIdSet.has(sid) || (code && basketCodeSet.has(code));
            return (
              <View style={[styles.cardWrap, { width: itemWidth }]}>
                <ProductCard
                  product={item}
                  onAddToBasket={() => handleAdd(item)}
                  inBasket={inBasket || !!addingIds[sid]}
                  adding={!!addingIds[sid]}
                />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', paddingHorizontal: 16, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingTop: 12, paddingBottom: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingRight: 8 },
  backText: { marginLeft: 4, fontSize: 14, color: '#666' },
  pillsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginLeft: 'auto' },
  sortPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: '#e6eef0' },
  sortPillActive: { backgroundColor: '#5a9ea6' },
  sortText: { color: '#fff' },
  loadingText: { fontSize: 16, color: '#666', marginTop: 12 },
  errorText: { fontSize: 16, color: '#e74c3c', marginTop: 12 },
  listContent: { paddingTop: 8, paddingBottom: 16 },
  columnWrap: { columnGap: 16, paddingHorizontal: 2 } as any,
  cardWrap: { paddingHorizontal: 8 },
});
