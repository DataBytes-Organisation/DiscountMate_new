import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Product } from '@/types/product';

interface RelatedProductsProps {
  products: Product[];
  title?: string;
}

export default function RelatedProducts({ 
  products, 
  title = "You might also like" 
}: RelatedProductsProps) {
  const router = useRouter();
  
  if (products.length === 0) return null;
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {products.map((product) => (
          <Pressable 
            key={product.id} 
            style={styles.productCard}
            onPress={() => router.push(`/product/${product.id}`)}
          >
            <Image 
              source={{ uri: product.image }} 
              style={styles.productImage} 
              resizeMode="cover"
            />
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={styles.productPrice}>
                ${product.discountPrice || product.price}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  productCard: {
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productImage: {
    width: '100%',
    height: 120,
  },
  productInfo: {
    padding: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    height: 40,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e74c3c',
  },
});