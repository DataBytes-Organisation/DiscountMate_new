import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Picker } from "@react-native-picker/picker";
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
   const [sortOption, setSortOption] = useState<string>("price-desc");
   const [currentPage, setCurrentPage] = useState<number>(1);

   const pageSize = 30; // 25-30 cards per page

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

               await new Promise<void>((resolve) => {
                  Papa.parse(text, {
                     header: true,
                     skipEmptyLines: true,
                     complete: (results) => {
                        const parsedProducts = results.data
                           .filter(
                              (item: any) =>
                                 item["Category"] === "Fruit & Veg" ||
                                 item["category"] === "Fruit & Vegetables"
                           )
                           .map((item: any) => ({
                              name:
                                 item["item_name"]?.trim() ||
                                 item["Item Name"]?.trim() ||
                                 "Unnamed Product",
                              description: item["description"]?.trim()
                                 ? item["description"]
                                 : url.includes("coles")
                                    ? "Coles Pricing"
                                    : "Woolworths Pricing",
                              price:
                                 parseFloat(item["item_price"] || item["Item Price"]) || 0,
                              bestPrice:
                                 parseFloat(item["best_price"] || item["Best Price"]) ||
                                 0,
                              bestUnitPrice:
                                 parseFloat(
                                    item["best_unit_price"] || item["Best Unit Price"]
                                 ) || 0,
                              unitPrice:
                                 parseFloat(item["unit_price"] || item["Unit Price"]) ||
                                 0,
                              originalPrice:
                                 parseFloat(item["item_price"] || item["Item Price"]) ||
                                 0,
                              discountPrice:
                                 parseFloat(
                                    item["DiscountedPrice"] || item["Discount Price"]
                                 ) || 0,
                           }));

                        allProducts.push(...parsedProducts);
                        resolve();
                     },
                     error: (err) => {
                        console.error(`CSV parsing error for ${url}:`, err);
                        setError("Failed to parse one or more CSVs.");
                        resolve();
                     },
                  });
               });
            }

            setProducts([...allProducts]);
         } catch (err) {
            console.error("File read error:", err);
            setError("Failed to load products.");
         }
      };

      loadCSV();
   }, []);

   const handleSortChange = (option: string) => {
      setSortOption(option);
      setCurrentPage(1);
   };

   const uniqueProductsMap = new Map<string, Product>();
   products.forEach((product) => uniqueProductsMap.set(product.name, product));
   const uniqueProducts = Array.from(uniqueProductsMap.values());

   const sortedProducts = [...uniqueProducts].sort((a, b) => {
      switch (sortOption) {
         case "price-asc":
            return a.price - b.price;
         case "price-desc":
            return b.price - a.price;
         case "bestPrice-asc":
            return a.bestPrice - b.bestPrice;
         case "bestPrice-desc":
            return b.bestPrice - a.bestPrice;
         case "bestUnitPrice-asc":
            return a.bestUnitPrice - b.bestUnitPrice;
         case "bestUnitPrice-desc":
            return b.bestUnitPrice - a.bestUnitPrice;
         case "discountPrice-asc":
            return a.discountPrice - b.discountPrice;
         case "discountPrice-desc":
            return b.discountPrice - a.discountPrice;
         case "name-asc":
            return a.name.localeCompare(b.name);
         case "name-desc":
            return b.name.localeCompare(a.name);
         default:
            return 0;
      }
   });

   const totalPages = Math.ceil(sortedProducts.length / pageSize);
   const paginatedProducts = sortedProducts.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
   );

   const startItem = (currentPage - 1) * pageSize + 1;
   const endItem = Math.min(currentPage * pageSize, sortedProducts.length);

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
            <Text style={styles.loadingText}>Loading products...</Text>
         </View>
      );
   }

   return (
      <ScrollView style={styles.container}>
         <Text style={styles.title}>🍏 Product Catalogue</Text>

         {/* Sort Filter */}
         <View style={styles.sortContainer}>
            <Text style={styles.sortLabel}>Sort By:</Text>
            <Picker
               selectedValue={sortOption}
               onValueChange={handleSortChange}
               style={styles.picker}
            >
               <Picker.Item label="Price: High to Low" value="price-desc" />
               <Picker.Item label="Price: Low to High" value="price-asc" />
               <Picker.Item label="Best Price: High to Low" value="bestPrice-desc" />
               <Picker.Item label="Best Price: Low to High" value="bestPrice-asc" />
               <Picker.Item
                  label="Best Unit Price: High to Low"
                  value="bestUnitPrice-desc"
               />
               <Picker.Item
                  label="Best Unit Price: Low to High"
                  value="bestUnitPrice-asc"
               />
               <Picker.Item
                  label="Discount Price: High to Low"
                  value="discountPrice-desc"
               />
               <Picker.Item
                  label="Discount Price: Low to High"
                  value="discountPrice-asc"
               />
               <Picker.Item label="Name: A to Z" value="name-asc" />
               <Picker.Item label="Name: Z to A" value="name-desc" />
            </Picker>
         </View>

         <Text style={styles.currentRangeText}>
            Showing {startItem}–{endItem} of {sortedProducts.length} products
         </Text>

         {/* Product Grid */}
         <View style={styles.gridContainer}>
            {paginatedProducts.map((product, index) => {
               const hasDiscount =
                  product.discountPrice &&
                  product.originalPrice &&
                  product.discountPrice < product.originalPrice;

               return (
                  <View key={index} style={styles.productCard}>
                     <View style={styles.cardHeader}>
                        <Text style={styles.productName}>{product.name}</Text>
                        {hasDiscount && (
                           <View style={styles.badge}>
                              <Text style={styles.badgeText}>
                                 Save ${Math.abs(product.originalPrice - product.discountPrice).toFixed(2)}
                              </Text>
                           </View>
                        )}
                     </View>
                     <Text style={styles.productDescription}>{product.description}</Text>

                     <View style={styles.priceRow}>
                        {hasDiscount ? (
                           <>
                              <Text style={styles.originalPrice}>
                                 ${product.originalPrice.toFixed(2)}
                              </Text>
                              <Text style={styles.discountPrice}>
                                 ${product.discountPrice.toFixed(2)}
                              </Text>
                           </>
                        ) : (
                           <Text style={styles.singlePrice}>
                              ${product.originalPrice.toFixed(2)}
                           </Text>
                        )}
                     </View>

                     <View style={styles.detailsBox}>
                        <Text style={styles.productDetail}>
                           Item Price: ${product.price.toFixed(2)}
                        </Text>
                        <Text style={styles.productDetail}>
                           Best Price: ${product.bestPrice.toFixed(2)}
                        </Text>
                        <Text style={styles.productDetail}>
                           Best Unit Price: ${product.bestUnitPrice.toFixed(2)}
                        </Text>
                        <Text style={styles.productDetail}>
                           Unit Price: ${product.unitPrice.toFixed(2)}
                        </Text>
                     </View>
                  </View>
               );
            })}
         </View>

         {/* Pagination Controls */}
         <View style={styles.paginationContainer}>
            <Text
               style={[styles.paginationButton, currentPage === 1 && { opacity: 0.5 }]}
               onPress={() => setCurrentPage(1)}
            >
               {"<<"}
            </Text>
            <Text
               style={[styles.paginationButton, currentPage === 1 && { opacity: 0.5 }]}
               onPress={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
            >
               {"<"}
            </Text>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
               .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))
               .map((page) => (
                  <Text
                     key={page}
                     style={[
                        styles.paginationButton,
                        page === currentPage && styles.paginationButtonActive,
                     ]}
                     onPress={() => setCurrentPage(page)}
                  >
                     {page}
                  </Text>
               ))}

            <Text
               style={[
                  styles.paginationButton,
                  currentPage === totalPages && { opacity: 0.5 },
               ]}
               onPress={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
            >
               {">"}
            </Text>
            <Text
               style={[
                  styles.paginationButton,
                  currentPage === totalPages && { opacity: 0.5 },
               ]}
               onPress={() => setCurrentPage(totalPages)}
            >
               {">>"}
            </Text>
         </View>
      </ScrollView>
   );
};

const styles = StyleSheet.create({
   container: { flex: 1, padding: 16, backgroundColor: "#f4f6f9" },
   loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
   loadingText: { fontSize: 18, color: "#555" },
   errorContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
   errorText: { fontSize: 18, color: "#d9534f", fontWeight: "600" },

   title: { fontSize: 26, fontWeight: "700", color: "#2a9d8f", textAlign: "center", marginBottom: 20 },

   sortContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
      backgroundColor: "#fff",
      padding: 10,
      borderRadius: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 6,
   },
   sortLabel: { fontSize: 16, marginRight: 10, color: "#333", fontWeight: "500" },
   picker: { flex: 1, height: 40 },

   currentRangeText: { fontSize: 16, textAlign: "center", marginVertical: 8, color: "#555" },

   gridContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", marginHorizontal: -6 },

   productCard: {
      flexBasis: "32%", // each card ~1/3 of row
      flexGrow: 1,
      margin: 6,
      backgroundColor: "#fff",
      borderRadius: 16,
      padding: 16,
      shadowColor: "#457b9d",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
   },
   cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
   productName: { fontSize: 18, fontWeight: "700", color: "#1d3557" },
   productDescription: { fontSize: 14, color: "#666", marginBottom: 10 },

   badge: { backgroundColor: "#e63946", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, shadowColor: "#e63946", shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
   badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },

   priceRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
   originalPrice: { fontSize: 15, textDecorationLine: "line-through", color: "#888", marginRight: 10 },
   discountPrice: { fontSize: 18, fontWeight: "700", color: "#2a9d8f" },
   singlePrice: { fontSize: 18, fontWeight: "700", color: "#1d3557" },

   detailsBox: { backgroundColor: "#f1faee", padding: 12, borderRadius: 10 },
   productDetail: { fontSize: 14, color: "#333", marginBottom: 4 },

   paginationContainer: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", marginVertical: 16 },
   paginationButton: {
      backgroundColor: "#fff",
      margin: 4,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      fontSize: 16,
      color: "#2a9d8f",
      fontWeight: "600",
      shadowColor: "#457b9d",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
   },
   paginationButtonActive: {
      backgroundColor: "#2a9d8f",
      color: "#fff",
      shadowColor: "#1d3557",
      shadowOpacity: 0.3,
   },
});

export default ProductPage;
