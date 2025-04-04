import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface Product {
  name: string;
  description: string;
  price: number;
}

const ProductPage = () => {
  const [products, setProducts] = useState<Product[]>([]); // Changed state to an array of products
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Mock data (replace API call with mock data for now)
    const mockProducts: Product[] = [
      {
        name: "Sample Product 1",
        description: "This is a sample product description 1.",
        price: 29.99,
      },
      {
        name: "Sample Product 2",
        description: "This is a sample product description 2.",
        price: 49.99,
      },
      {
        name: "Sample Product 3",
        description: "This is a sample product description 3.",
        price: 19.99,
      },
    ];

    // Simulate API delay
    setTimeout(() => {
      setProducts(mockProducts);
    }, 1000); // 1 second delay to simulate loading

    // Commented out actual API call for now
    // const fetchProducts = async () => {
    //   try {
    //     const response = await fetch("https://api.example.com/products"); // Will draw in API data from the backend
    //
    //     // Handle non-OK responses
    //     if (!response.ok) {
    //       throw new Error(`HTTP error! Status: ${response.status}`);
    //     }
    //
    //     const data: Product[] = await response.json();
    //     setProducts(data);
    //   } catch (err) {
    //     console.error("Failed to fetch products:", err);
    //     setError("Failed to load products. Please try again later.");
    //   }
    // };
    //
    // fetchProducts();
  }, []);

  // Display error message if API fails
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Show loading while fetching
  if (products.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Title of the Product Page */}
      <Text style={styles.title}>Product Page</Text>

      {products.map((product, index) => (
        <View key={index} style={styles.productContainer}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productDescription}>{product.description}</Text>
          <Text style={styles.productPrice}>{`$${product.price.toFixed(2)}`}</Text>
        </View>
      ))}
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
    fontSize: 30,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center", // Center the title
    marginBottom: 20, // Add space below the title
  },
  productContainer: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  productName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  productDescription: {
    fontSize: 16,
    color: "#555",
    marginBottom: 10,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a9bfc",
  },
});

export default ProductPage;






