import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useNavigation } from 'expo-router';
import Papa from 'papaparse';
import Icon from 'react-native-vector-icons/FontAwesome';

type ProductType = {
  [key: string]: string | number;
};

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();

  const [product, setProduct] = useState<ProductType | null>(null);
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
            console.log('CSV parsed', results.data);

            const foundProduct = results.data.find(
              (item: any) => item['Product Code'] === id || item['Item Name'] === id
            );

            if (foundProduct) {
              setProduct(foundProduct);
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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.content}>
        <ScrollView style={styles.mainContent} contentContainerStyle={styles.scrollContent}>
          <View style={styles.navigation}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <Icon name="angle-left" size={24} color="#666" />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </View>

          <View style={styles.productCard}>
            <Text style={styles.productName}>{product['Item Name'] || 'Unnamed Product'}</Text>
            <Text>Category: {product['Category'] || 'N/A'}</Text>
            <Text>Product Code: {product['Product Code'] || 'N/A'}</Text>
            <Text>Best Price: ${product['Best Price'] || ''}</Text>
            <Text>Best Unit Price: ${product['Best Unit Price'] || ''}</Text>
            <Text>Item Price: ${product['Item Price'] || ''}</Text>
            <Text>Unit Price: ${product['Unit Price'] || ''}</Text>
            <Text>Original Price: ${product['Original Price'] || ''}</Text>
            <Text>Discount Price: ${product['Discount Price'] || ''}</Text>
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
    padding: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  productName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333',
  },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  errorText: { fontSize: 18, color: '#e74c3c', marginBottom: 16 },
  backButtonText: { color: '#5a9ea6', fontSize: 16 },
});

