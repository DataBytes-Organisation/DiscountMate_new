import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Alert, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/FontAwesome';
import ProductCard from '@/components/ProductCard';
import { Product } from '@/types/product';
import { useBasket } from '../BasketContext';
import CartBadge from '@/components/CartBadge';

const API_BASE =
  (typeof process !== 'undefined' && (process as any)?.env?.EXPO_PUBLIC_API_BASE) ||
  (typeof window !== 'undefined' && (window as any)?.location?.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'http://localhost:3000');

const PAGE_LIMIT = 500;

function getStableId(rec: any): string {
  return String(rec?.productCode ?? rec?.product_code ?? rec?.id ?? rec?._id ?? rec?.product_id ?? rec?.productId ?? '');
}

const EXACT_LABELS = [
  'Bakery',
  'Dairy, Eggs & Fridge',
  'Deli',
  'Drinks',
  'Frozen',
  'Fruit & Vegetables',
  'Health & Beauty',
  'Household',
  'Meat & Seafood',
  'Pantry',
] as const;

const ALIASES: Record<string, (typeof EXACT_LABELS)[number]> = {
  'bakery': 'Bakery',
  'drinks': 'Drinks',
  'frozen': 'Frozen',
  'household': 'Household',
  'pantry': 'Pantry',
  'deli': 'Deli',
  'health-beauty': 'Health & Beauty',
  'meat-seafood': 'Meat & Seafood',
  'dairy-eggs-fridge': 'Dairy, Eggs & Fridge',
  'dairy-eggs': 'Dairy, Eggs & Fridge',
  'dairy-eggs-and-fridge': 'Dairy, Eggs & Fridge',
  'fruit-veg': 'Fruit & Vegetables',
  'fruitveg': 'Fruit & Vegetables',
  'fruit-and-veg': 'Fruit & Vegetables',
  'fruit-and-vegetables': 'Fruit & Vegetables',
  'fruit-vegetables': 'Fruit & Vegetables',
  'freezer': 'Frozen',
  'poultry-meat-seafood': 'Meat & Seafood',
  'meat-and-seafood': 'Meat & Seafood',
  'deli-chilled': 'Deli',
  'deli-chilled-meals': 'Deli',
  'snacks': 'Pantry',
  'snacks-confectionery': 'Pantry',
  'international-foods': 'Pantry',
  'lunch-box': 'Pantry',
};

function slugify(s: string) { return s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function toCanonicalLabel(rawId: string | undefined) {
  const raw = decodeURIComponent(String(rawId ?? '')).trim();
  if (EXACT_LABELS.includes(raw as any)) return raw as (typeof EXACT_LABELS)[number];
  const slug = slugify(raw);
  return ALIASES[slug] ?? raw;
}
function normalize(s: unknown) {
  return String(s ?? '').toLowerCase().replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
}
function matchesCategory(val: unknown, target: string) {
  const v = normalize(val);
  const t = normalize(target);
  if (!v || !t) return false;
  const tokens = v.split(/[>/|,-]/).map(x => x.trim()).filter(Boolean);
  return v === t || v.includes(t) || tokens.includes(t);
}
const CATEGORY_FIELDS = ['category','Category','categories','Categories','department','Department','dept','Dept','aisle','Aisle','section','Section','category_name','CategoryName','categoryPath','category_path'] as const;

type ApiDoc = {
  _id?: string | number;
  product_id?: string | number;
  product_code?: string | number;
  product_name?: string;
  item_name?: string;
  name?: string;
  link_image?: string;
  image?: string;
  current_price?: number | string;
  item_price?: number | string;
  best_price?: number | string;
  price?: number | string;
  category?: string | string[];
  Category?: string | string[];
};

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const label = toCanonicalLabel(id);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { addToBasket, basketData } = useBasket() as any;

  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingIds, setAddingIds] = useState<Record<string, true>>({});

  const numColumns = useMemo(() => {
    if (width >= 1500) return 5;
    if (width >= 1200) return 4;
    if (width >= 900)  return 3;
    if (width >= 600)  return 2;
    return 1;
  }, [width]);
  const itemWidth = `${100 / numColumns}%`;

  const onAdd = async (p: Product) => {
    const sid = getStableId(p);
    if (!sid || addingIds[sid]) return;

    const price = (typeof (p as any).discountPrice === 'number' ? (p as any).discountPrice : undefined) ?? (p as any).price ?? 0;

    setAddingIds(s => ({ ...s, [sid]: true }));
    const ok = await addToBasket({
      product_id: sid,
      product_code: (p as any).productCode ?? (p as any).product_code ?? sid,
      quantity: 1,
      name: (p as any).name,
      price,
      image: (p as any).image || '',
    });
    setAddingIds(s => { const c = { ...s }; delete c[sid]; return c; });
    if (!ok) Alert.alert('Add failed', 'Could not add this item to your basket.');
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true); setError(null);

        const firstUrl = `${API_BASE}/api/products?db=CleanedData&collection=Coles&category=${encodeURIComponent(label)}&limit=${PAGE_LIMIT}`;
        let r = await fetch(firstUrl);
        let data: ApiDoc[] = [];
        if (r.ok) {
          const arr = (await r.json()) as any[];
          if (Array.isArray(arr)) data = arr;
        }

        if (!Array.isArray(data) || data.length === 0) {
          const unionUrl = `${API_BASE}/api/products?sources=DiscountMate.product,CleanedData.Coles&limit=${PAGE_LIMIT}`;
          r = await fetch(unionUrl);
          if (!r.ok) throw new Error(`Products fetch failed (${r.status})`);
          const arr = (await r.json()) as any[];
          data = Array.isArray(arr) ? arr : [];
        }

        const mapped: Product[] = data.map((it) => {
          const idv = String(it.product_code ?? it._id ?? it.product_id ?? it.productId ?? '');
          const name = String(it.product_name ?? it.item_name ?? it.name ?? 'Unnamed');
          const image = String(it.link_image ?? it.image ?? '');
          const priceNum = Number(it.current_price ?? it.item_price ?? it.best_price ?? it.price ?? 0);
          const categoryVal: any = (it as any).category ?? (it as any).Category ?? (it as any).categories;
          return {
            id: idv,
            name,
            image,
            price: priceNum,
            originalPrice: priceNum,
            discountPrice: priceNum,
            unit: '',
            description: '',
            nutritionalInfo: { calories: 0, protein: '', fat: '', carbs: '', sugar: '' },
            stock: 0, rating: 0, reviews: 0, isOrganic: false, isFeatured: false,
            tags: [], relatedProducts: [],
            category: categoryVal,
            productCode: String(it.product_code ?? ''),
          } as unknown as Product;
        }).filter((p: any) => !!getStableId(p));

        const seen = new Set<string>();
        const unique = mapped.filter((p: any) => {
          const key = getStableId(p);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const filtered = unique.filter((rec: any) => {
          for (const k of CATEGORY_FIELDS) {
            const v: any = (rec as any)[k];
            if (!v) continue;
            if (Array.isArray(v)) { if (v.some(x => matchesCategory(x, label))) return true; }
            else if (typeof v === 'object') { if (Object.values(v).some(x => matchesCategory(x, label))) return true; }
            else if (matchesCategory(v, label)) { return true; }
          }
          return matchesCategory((rec as any).category, label);
        });

        setRows(filtered);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Failed to load category items.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [label]);

  const basketIdSet = useMemo(() => new Set((basketData || []).map((it: any) => String(it.productId || ''))), [basketData]);
  const basketCodeSet = useMemo(() => new Set((basketData || []).map((it: any) => String(it.productCode || '').toLowerCase())), [basketData]);
  const basketQty = useMemo(() => {
    if (!Array.isArray(basketData)) return 0;
    const sum = basketData.reduce((s: number, it: any) => s + Number(it.quantity || 0), 0);
    return sum || basketData.length || 0;
  }, [basketData]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.mainContent}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.navigation}>
              <Pressable style={styles.backButton} onPress={() => router.back()}>
                <Icon name="chevron-left" size={16} color="#666" />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            </View>

            <Stack.Screen
              options={{
                title: label || 'Category',
                headerRight: () => <CartBadge count={basketQty} />,
              }}
            />

            {loading && <Text style={styles.loadingText}>Loading…</Text>}
            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={[styles.productsGrid, Platform.OS === 'web' && styles.webProductWrapper]}>
              {!loading && !error && rows.length > 0 ? (
                rows.map((p: any) => {
                  const sid = getStableId(p);
                  const code = String((p as any).productCode ?? (p as any).product_code ?? '').toLowerCase();
                  const inBasket = basketIdSet.has(sid) || (code && basketCodeSet.has(code));
                  return (
                    <View key={sid} style={[styles.productWrapper, Platform.OS === 'web' && styles.webProductWrapper, { width: itemWidth }]}>
                      <ProductCard
                        product={p}
                        onAddToBasket={() => onAdd(p)}
                        inBasket={inBasket || !!addingIds[sid]}
                        adding={!!addingIds[sid]}
                      />
                    </View>
                  );
                })
              ) : (
                !loading && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No products found in this category</Text>
                    <Pressable style={styles.browseButton} onPress={() => router.push('/(tabs)/productpage')}>
                      <Text style={styles.browseButtonText}>Browse all products</Text>
                    </Pressable>
                  </View>
                )
              )}
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
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 16 },
  productWrapper: { marginBottom: 16 },
  webProductWrapper: {},
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyStateText: { fontSize: 16, color: '#666', marginBottom: 16, textAlign: 'center' },
  browseButton: { backgroundColor: '#5a9ea6', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 4 },
  browseButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
});