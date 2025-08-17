import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { API_URL } from '@/constants/Api';
import { useBasket } from './BasketContext';

const fetchSearchResults = async (query) => {
  const url = `${API_URL}/products?search=${query}`;
  console.log("Fetching search results from:", url);
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    return [];
  }
};

export default function SearchResults() {
  const { query } = useLocalSearchParams();
  const [results, setResults] = useState([]);
  const { addToBasket } = useBasket();

  useEffect(() => {
    const getResults = async () => {
      if (typeof query === 'string') {
        const searchResults = await fetchSearchResults(query);
        setResults(searchResults);
      }
    };
    getResults();
  }, [query]);

  const renderProduct = ({ item }) => (
    <View style={styles.productContainer}>
      <Image source={{ uri: item.link_image }} style={styles.productImage} />
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.product_name}</Text>
        <Text style={styles.productPrice}>${item.current_price}</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => addToBasket(item)}>
          <Text style={styles.addButtonText}>Add to Basket</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search Results for "{query}"</Text>
      <FlatList
        data={results}
        renderItem={renderProduct}
        keyExtractor={(item) => item._id}
        numColumns={2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  productContainer: {
    flex: 1,
    margin: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 150,
  },
  productInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  productPrice: {
    fontSize: 14,
    color: '#ff5733',
    marginVertical: 5,
  },
  addButton: {
    backgroundColor: '#6595a3',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
  },
});