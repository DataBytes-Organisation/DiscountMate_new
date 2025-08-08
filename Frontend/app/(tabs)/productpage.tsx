import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define the product shape returned from the API
interface Product {
  _id: string;
  product_id: number;
  product_name: string;
  description?: string;
  sub_category_1?: string;
  current_price: number;
  link_image: string;
}

const ProductPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [basketData, setBasketData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch products from the backend API
  const fetchProducts = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/products');
      const data = await response.json();
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError('Failed to load products. Please try again later.');
    }
  };

  // Fetch the user's basket to determine which items are already present
  const getBasket = async () => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;
    try {
      const response = await fetch('http://localhost:3000/api/baskets/getbasket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setBasketData(Array.isArray(data) ? data: []);
    } catch (err) {
      console.error('Error fetching basket:', err);
    }
  };

  // Add a product to the basket
  const addToBasket = async (product: Product) => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;
    try {
      const response = await fetch('http://localhost:3000/api/baskets/addtobasket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ product_id: product.product_id, quantity: 1 }),
      });
      // Ignore response body; refresh basket instead
      await response.json().catch(() => {});
      await getBasket();
    } catch (err) {
      console.error('Error adding to basket:', err);
    }
  };

  // Check if a product already exists in the basket
  const doesItemExistInBasket = (product: Product) => {
    if(!Array.isArray(basketData)) return false;
    return basketData.some((item) => item.productId === product.product_id);
  };

  useEffect(() => {
    fetchProducts();
    getBasket();
  }, []);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Show loading if products list is empty
  if (products.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Products</Text>
      {products.map((product, index) => {
        const inBasket = doesItemExistInBasket(product);
        return (
          <View key={index} style={styles.productCard}>
            <Image source={{ uri: product.link_image }} style={styles.productImage} />
            <View style={styles.productDetails}>
              <Text style={styles.productName}>{product.product_name}</Text>
              <Text style={styles.productDescription}>{product.sub_category_1 || ''}</Text>
              <Text style={styles.productPrice}>${Number(product.current_price).toFixed(2)}</Text>
            </View>
            <View style={styles.productActions}>
              <TouchableOpacity
                disabled={inBasket}
                onPress={() => addToBasket(product)}
                style={inBasket ? styles.addButtonDisabled : styles.addButton}
              >
                <Text style={styles.addButtonText}>{inBasket ? 'Added' : 'Add to Basket'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
  },
  loadingText: {
    fontSize: 20,
    color: "#999",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffe6e6",
  },
  errorText: {
    fontSize: 18,
    color: "#d9534f",
    fontWeight: "bold",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 16,
  },
  // Card layout for each product
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 10,
  },
  productDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a9bfc',
  },
  productActions: {
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: '#6595a3',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ProductPage;
