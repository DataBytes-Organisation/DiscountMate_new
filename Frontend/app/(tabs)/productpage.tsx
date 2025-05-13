import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Button, Picker } from "react-native";
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

const ProductPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<string>('desc'); // state for sorting option

  useEffect(() => {
    const loadCSV = async () => {
      try {
        const urls = [
          "/public/woolworths_cleaned.csv",
          "/public/coles_synthetic_dataset_8_weeks.csv",
        ];

        const allProducts: Product[] = [];

        for (const url of urls) {
          const response = await fetch(url);
          const text = await response.text();

          Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              const parsedProducts = results.data
                .filter((item: any) =>
                  item["Category"] === "Fruit & Veg" ||
                  item["category"] === "Fruit & Vegetables"
                )
                .map((item: any) => ({
                  name: item["item_name"]?.trim() ||
                  item["Item Name"]?.trim() ||
                  "Unnamed Product",
                  description: item["description"]?.trim()
                    ? item["description"]
                    : url.includes("coles")
                      ? "Coles Pricing:"
                      : "Woolworths Pricing:",
                  price: parseFloat(item["item_price"] || item["Item Price"]) || 0,
                  bestPrice: parseFloat(item["best_price"] || item["Best Price"]) || 0,
                  bestUnitPrice: parseFloat(item["best_unit_price"] || item["Best Unit Price"]) || 0,
                  unitPrice: parseFloat(item["unit_price"] || item["Unit Price"]) || 0,
                  originalPrice: parseFloat(item["item_price"] || item["Item Price"]) || 0,
                  discountPrice: parseFloat(item["DiscountedPrice"] || item["Discount Price"]) || 0,
                }));

              allProducts.push(...parsedProducts);
              setProducts([...allProducts]);
            },
            error: (err) => {
              console.error(`CSV parsing error for ${url}:`, err);
              setError("Failed to parse one or more CSVs.");
            },
          });
        }
      } catch (err) {
        console.error("File read error:", err);
        setError("Failed to load products.");
      }
    };

    loadCSV();
  }, []);

  const handleSortChange = (option: string) => {
    setSortOption(option);
  };

  // Filters out duplicate items in datasets
  const uniqueProductsMap = new Map();
  products.forEach((product) => {
    uniqueProductsMap.set(product.name, product);
  });
  const uniqueProducts = Array.from(uniqueProductsMap.values());
  
  const sortedProducts = [...uniqueProducts].sort((a, b) => {
    if (sortOption === "asc") {
      return a.price - b.price;
    } else {
      return b.price - a.price;
    }
  });
  

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

      {/* Sort Filter Dropdown */}
      <View style={styles.sortContainer}>
        <Text>Sort by Price</Text>
        <Picker
          selectedValue={sortOption}
          onValueChange={handleSortChange}
          style={styles.picker}
        >
          <Picker.Item label="Highest to Lowest" value="desc" />
          <Picker.Item label="Lowest to Highest" value="asc" />
        </Picker>
      </View>

      {sortedProducts.map((product, index) => (
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
  sortContainer: {
    marginBottom: 20,
  },
  picker: {
    height: 50,
    width: 150,
  },
  productContainer: {
    marginBottom: 12, 
    padding: 8,        
    backgroundColor: "#f9f9f9",
    borderRadius: 8,   
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,    
  },
  
  productName: {
    fontSize: 20,  
    fontWeight: "bold",
    marginBottom: 6,
  },
  productDescription: {
    fontSize: 14,  
    color: "#555",
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 16, 
    fontWeight: "bold",
    color: "#1a9bfc",
  },
  
});

export default ProductPage;


























