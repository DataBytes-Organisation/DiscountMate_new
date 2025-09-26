import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Image } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import Papa from 'papaparse';
import Icon from 'react-native-vector-icons/FontAwesome';
import { Product } from '@/types/product';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCSV = async () => {
      try {
        const response = await fetch('/woolworths_cleaned.csv');
        const text = await response.text();

        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const foundProduct = results.data.find(
              (item: any) => item['Product Code'] === id || item['Item Name'] === id
            );

            if (foundProduct) {
              const mappedProduct: Product = {
                id: foundProduct['Product Code'],
                name: foundProduct['Item Name'],
                category: foundProduct['Category'],
                subcategory: '',
                price: parseFloat(foundProduct['Item Price']) || 0,
                discountPrice: foundProduct['Discount Price']
                  ? parseFloat(foundProduct['Discount Price'])
                  : parseFloat(foundProduct['Item Price']) || 0,
                originalPrice: foundProduct['Original Price']
                  ? parseFloat(foundProduct['Original Price'])
                  : parseFloat(foundProduct['Item Price']) || 0,
                unit: foundProduct['Unit Price'] || '',
                image: `https://assets.woolworths.com.au/images/1005/${foundProduct['Product Code']}.jpg?impolicy=wowsmkqiema` || '',
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
                productCode: foundProduct['Product Code'],
                bestPrice: foundProduct['Best Price'] ? parseFloat(foundProduct['Best Price']) : null,
                bestUnitPrice: foundProduct['Best Unit Price'] ? parseFloat(foundProduct['Best Unit Price']) : null,
                itemPrice: foundProduct['Item Price'] ? parseFloat(foundProduct['Item Price']) : null,
                unitPrice: foundProduct['Unit Price'] ? parseFloat(foundProduct['Unit Price']) : null,
              };
              setProduct(mappedProduct);
            } else {
              setError('Product not found.');
            }
          },
          error: (err) => {
            console.error('CSV parsing error:', err);
            setError('Failed to parse CSV.');
          },
        });
      } catch (err) {
        console.error('File read error:', err);
        setError('Failed to load product.');
      }
    };

    loadCSV();
  }, [id]);

  if (error) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
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
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.content}>
          <Text>Loading...</Text>
        </View>
      </View>
    );
  }

  const handleAddToBasket = () => {
    console.log('Add to basket clicked for:', product.name);
  };

  const originalPrice = product.originalPrice ?? product.price;
  const discountedPrice = product.discountPrice ?? product.price;
  const showDiscount = discountedPrice < originalPrice;

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

          <View style={styles.productCard}>
            <Image source={{ uri: product.image || '' }} style={styles.image} resizeMode="contain" />
            <View style={styles.infoContainer}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.category}>Category: {product.category}</Text>
              {product.productCode && (
                <Text style={styles.productCode}>Product Code: {product.productCode}</Text>
              )}

              <View style={styles.priceContainer}>
                {showDiscount ? (
                  <>
                    <Text style={styles.discountPrice}>${discountedPrice.toFixed(2)}</Text>
                    <Text style={styles.originalPrice}>${originalPrice.toFixed(2)}</Text>
                  </>
                ) : (
                  <Text style={styles.price}>${product.price.toFixed(2)}</Text>
                )}
              </View>

              <View style={styles.detailsContainer}>
                <Text style={styles.detailText}>Best Price: ${product.bestPrice?.toFixed(2) || 'N/A'}</Text>
                <Text style={styles.detailText}>Best Unit Price: ${product.bestUnitPrice?.toFixed(2) || 'N/A'}</Text>
                <Text style={styles.detailText}>Item Price: ${product.itemPrice?.toFixed(2) || 'N/A'}</Text>
                <Text style={styles.detailText}>Unit Price: ${product.unitPrice?.toFixed(2) || 'N/A'}</Text>
              </View>

              <View style={styles.actionsContainer}>
                <Pressable style={styles.addToBasketButton} onPress={handleAddToBasket}>
                  <Text style={styles.buttonText}>Add To Basket</Text>
                </Pressable>
              </View>
            </View>
          </View>
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
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  image: {
    width: '100%',
    height: 300,
    backgroundColor: '#fff',
  },
  infoContainer: {
    padding: 16,
  },
  productName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    color: '#333',
  },
  category: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  productCode: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  price: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e74c3c',
  },
  discountPrice: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e74c3c',
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  detailsContainer: {
    marginBottom: 16,
  },
  detailText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  actionsContainer: {
    marginTop: 16,
  },
  addToBasketButton: {
    backgroundColor: '#5a9ea6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    marginBottom: 16,
  },
  backButtonText: {
    color: '#5a9ea6',
    fontSize: 16,
  },
});