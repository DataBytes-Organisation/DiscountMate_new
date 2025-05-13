import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import * as Papa from "papaparse";

interface Product {
  name: string;
  description: string;
  price: number;
  bestPrice: number;
  bestUnitPrice: number;
  unitPrice: number;
  originalPrice: number;
  discountPrice: number;
}

const FruitVegPage= () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCSV = async () => {
      try {
        const response = await fetch("/public/woolworths_cleaned.csv");
        const text = await response.text();
    
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true, // Ignore empty lines
          complete: (results) => {
            console.log("CSV parsed", results);
    
            const limitedProducts = results.data
              .filter((item: any) => item["Category"] === "Fruit & Veg") // Filter only Fruit & Veg
              .map((item: any) => ({
                name: item["Item Name"] || "Unnamed Product",
                description: item["Description"] || "Woolworths Current Pricing:",
                price: parseFloat(item["Item Price"]) || 0,
                bestPrice: parseFloat(item["Best Price"]) || 0,
                bestUnitPrice: parseFloat(item["Best Unit Price"]) || 0,
                unitPrice: parseFloat(item["Unit Price"]) || 0,
                originalPrice: parseFloat(item["Original Price"]) || 0,
                discountPrice: parseFloat(item["Discount Price"]) || 0,
              }));
    
            setProducts(limitedProducts);
          },
          error: (err) => {
            console.error("CSV parsing error:", err);
            setError("Failed to parse CSV.");
          },
        });
      } catch (err) {
        console.error("File read error:", err);
        setError("Failed to load products.");
      }
    };

    loadCSV();
  }, []);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Product Page</Text>

      {products.map((product, index) => (
        <View key={index} style={styles.productContainer}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productDescription}>{product.description}</Text>
          <Text style={styles.productPrice}>Item Price: ${product.price.toFixed(2)}</Text>
          <Text style={styles.productPrice}>Best Price: ${product.bestPrice.toFixed(2)}</Text>
          <Text style={styles.productPrice}>Best Unit Price: ${product.bestUnitPrice.toFixed(2)}</Text>
          <Text style={styles.productPrice}>Unit Price: ${product.unitPrice.toFixed(2)}</Text>
          <Text style={styles.productPrice}>Original Price: ${product.originalPrice.toFixed(2)}</Text>
          <Text style={styles.productPrice}>Discount Price: ${product.discountPrice.toFixed(2)}</Text>
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
    textAlign: "center",
    marginBottom: 20,
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

export default FruitVegPage;