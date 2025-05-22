import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
// import { ArrowLeft, Filter } from 'lucide-react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
// import Header from '@/components/Header';
import ProductCard from '@/components/ProductCard';
import { getProductsByCategory, categories } from '@/mocks/products';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const products = getProductsByCategory(id || '');
  const category = categories.find(cat => cat.id === id);
  
  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      
      {/* <Header showSearch={true} showBrowse={true} /> */}
      
      <View style={styles.content}>
        {/* <Sidebar /> */}
        
        <ScrollView style={styles.mainContent} contentContainerStyle={styles.scrollContent}>
          <View style={styles.navigation}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Icon name="angle-left" size={24} color="#666"  />
              {/* <ArrowLeft size={16} color="#666" /> */}
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </View>
          
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryTitle}>{category?.name || 'Products'}</Text>
            
            <Pressable style={styles.filterButton}>
              {/* <Filter size={16} color="#5a9ea6" /> */}
            <Icon name="filter" size={24} color="#5a9ea6"  />

              <Text style={styles.filterText}>Filter</Text>
            </Pressable>
          </View>
          
          <Text style={styles.resultsCount}>{products.length} products found</Text>
          
          <View style={styles.productsGrid}>
            {products.map(product => (
              <View key={product.id} style={[
                styles.productWrapper,
                Platform.OS === 'web' ? styles.webProductWrapper : {}
              ]}>
                <ProductCard product={product} />
              </View>
            ))}
          </View>
          
          {products.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No products found in this category</Text>
              <Pressable 
                style={styles.browseButton}
                onPress={() => router.push('/')}
              >
                <Text style={styles.browseButtonText}>Browse all products</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  navigation: {
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#666',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#5a9ea6',
  },
  resultsCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productWrapper: {
    width: '48%',
    marginBottom: 16,
  },
  webProductWrapper: {
    width: '31%',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  browseButton: {
    backgroundColor: '#5a9ea6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  browseButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});