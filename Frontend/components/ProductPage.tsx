import React from 'react';
import { View, Text, Image, StyleSheet, Button, ScrollView } from 'react-native';

// Define the type for the product
type Product = {
  name: string;
  description: string;
  price: string;
  image: any; // Use ImageSourcePropType for stricter typing if desired
};

const ProductPage: React.FC = () => {
  const product: Product = {
    name: 'Wireless Headphones',
    description:
      'Experience amazing sound quality with these lightweight, wireless headphones. Built for comfort and durability.',
    price: '$99.99',
    image: require('../assets/images/product-image.jpg'), // Update path for your structure
  };

  const handleAddToCart = () => {
    alert('Product added to cart!');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={product.image} style={styles.image} />
      <Text style={styles.title}>{product.name}</Text>
      <Text style={styles.description}>{product.description}</Text>
      <Text style={styles.price}>{product.price}</Text>
      <Button title="Add to Cart" onPress={handleAddToCart} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 20,
  },
  image: {
    width: 300,
    height: 300,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  price: {
    fontSize: 20,
    color: 'green',
    marginBottom: 20,
  },
});

export default ProductPage;
