import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/FontAwesome';
import ProductCard from '@/components/ProductCard';
import Papa from 'papaparse';
import { Product } from '@/types/product';

type CSVProduct = {
  "Product Code": string;
  Category: string;
  "Item Name": string;
  "Best Price": string;
  "Best Unit Price": string;
  "Item Price": string;
  "Unit Price": string;
  "Original Price": string;
  "Discount Price": string;
};

const categoryMap: { [key: string]: string } = {
  "fruit-veg": "Fruit & Veg",
  bakery: "Bakery",
  "poultry-meat-seafood": "Poultry, Meat & Seafood",
  "deli-chilled": "Deli & Chilled Meals",
  "dairy-eggs": "Dairy, Eggs & Fridge",
  "lunch-box": "Lunch Box",
  pantry: "Pantry",
  international: "International Foods",
  snacks: "Snacks & Confectionery",
  freezer: "Freezer",
};

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 12;

  useEffect(() => {
    const loadCSV = async () => {
      try {
        const response = await fetch('/woolworths_cleaned.csv'); // woolworths
        // const response = await fetch('/coles_synthetic_dataset_8_weeks.csv'); //coles
        const text = await response.text();

        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const filteredCSV = (results.data as CSVProduct[]).filter(
              (item) => item.Category === categoryMap[id || '']
            );
            
            const mappedProducts: Product[] = filteredCSV.map((item) => ({
              id: item["Product Code"],
              name: item["Item Name"],
              category: item.Category,
              subcategory: '',
              price: parseFloat(item["Item Price"]) || 0,
              discountPrice: item["Discount Price"]
                ? parseFloat(item["Discount Price"])
                : parseFloat(item["Item Price"]) || 0,
              originalPrice: item["Original Price"]
                ? parseFloat(item["Original Price"])
                : parseFloat(item["Item Price"]) || 0,
              unit: item["Unit Price"] || '',
              image: `https://assets.woolworths.com.au/images/1005/${item["Product Code"]}.jpg?impolicy=wowsmkqiema` || '',
              description: '',
              nutritionalInfo: {
                calories: 0,
                protein: '',
                fat: '',
                carbs: '',
                sugar: '',
              },
              stock: 0,
              rating: 0,
              reviews: 0,
              isOrganic: false,
              isFeatured: false,
              tags: [],
              relatedProducts: [],
              productCode: item["Product Code"],
              bestPrice: item["Best Price"] ? parseFloat(item["Best Price"]) : null,
              bestUnitPrice: item["Best Unit Price"] ? parseFloat(item["Best Unit Price"]) : null,
              itemPrice: item["Item Price"] ? parseFloat(item["Item Price"]) : null,
              unitPrice: item["Unit Price"] ? parseFloat(item["Unit Price"]) : null,
            }));

            setProducts(mappedProducts);
            setLoading(false);
          },
          error: (err) => {
            setError('Failed to parse CSV.');
            setLoading(false);
            console.error(err);
          },
        });
      } catch (err) {
        setError('Failed to load CSV file.');
        setLoading(false);
        console.error(err);
      }
    };

    loadCSV();
  }, [id]);

  const totalPages = Math.ceil(products.length / productsPerPage);
  const paginatedProducts = products.slice(
    (currentPage - 1) * productsPerPage,
    currentPage * productsPerPage
  );

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.content}>
        <ScrollView style={styles.mainContent} contentContainerStyle={styles.scrollContent}>
          <View style={styles.navigation}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Icon name="angle-left" size={24} color="#666" />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </View>

          <Text style={styles.categoryTitle}>{categoryMap[id || ''] || 'Products'}</Text>

          {loading && <Text style={styles.loadingText}>Loading products...</Text>}
          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.productsGrid}>
            {paginatedProducts.length > 0 ? (
              paginatedProducts.map((product, index) => (
                <View
                  key={`${product.id}-${index}`}
                  style={[
                    styles.productWrapper,
                    Platform.OS === 'web' ? styles.webProductWrapper : {},
                  ]}
                >
                  <ProductCard product={product} />
                </View>
              ))
            ) : (
              !loading && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No products found in this category</Text>
                  <Pressable style={styles.browseButton} onPress={() => router.push('/')}>
                    <Text style={styles.browseButtonText}>Browse all products</Text>
                  </Pressable>
                </View>
              )
            )}
          </View>

          {totalPages > 1 && (
            <View style={styles.pagination}>
              <Pressable
                style={[styles.pageButton, currentPage === 1 && styles.disabledButton]}
                onPress={handlePrevPage}
                disabled={currentPage === 1}
              >
                <Text style={styles.pageButtonText}>Previous</Text>
              </Pressable>
              <Text style={styles.pageInfo}>
                Page {currentPage} of {totalPages}
              </Text>
              <Pressable
                style={[styles.pageButton, currentPage === totalPages && styles.disabledButton]}
                onPress={handleNextPage}
                disabled={currentPage === totalPages}
              >
                <Text style={styles.pageButtonText}>Next</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
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
  categoryTitle: { fontSize: 24, fontWeight: '600', color: '#333', marginBottom: 16 },
  loadingText: { fontSize: 16, color: '#666', marginBottom: 16 },
  errorText: { fontSize: 16, color: '#e74c3c', marginBottom: 16 },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  productWrapper: { width: '48%', marginBottom: 16 },
  webProductWrapper: { width: '31%' },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyStateText: { fontSize: 16, color: '#666', marginBottom: 16, textAlign: 'center' },
  browseButton: { backgroundColor: '#5a9ea6', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 4 },
  browseButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  pageButton: {
    backgroundColor: '#5a9ea6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  pageButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  pageInfo: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 16,
  },
});











