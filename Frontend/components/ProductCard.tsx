import React from 'react';
import { StyleSheet, Text, View, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
// import { Heart } from 'lucide-react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { Product } from '@/types/product';
// import { useBasketStore } from '@/store/basket-store';

interface ProductCardProps {
  product: Product;
  showActions?: boolean;
}

export default function ProductCard({ product, showActions = true }: ProductCardProps) {
  const router = useRouter();
  // const { addToBasket, isInBasket } = useBasketStore();
  // const inBasket = isInBasket(product.id);
  
  const handleAddToBasket = () => {
    // addToBasket(product, 1);
    console.log("clicked");
  };
  
  const navigateToProduct = () => {
    router.push(`/product/${product.id}`);
  };
  
  return (
    <View style={styles.container}>
      <Pressable 
        style={styles.imageContainer}
        onPress={navigateToProduct}
      >
        <Image 
          source={{ uri: product.image }} 
          style={styles.image} 
          resizeMode="cover"
        />
      </Pressable>
      
      <View style={styles.infoContainer}>
        <Pressable onPress={navigateToProduct}>
          <Text style={styles.name}>{product.name}</Text>
        </Pressable>
        
        <Text style={styles.subcategory}>{product.subcategory}</Text>
        
        <View style={styles.priceContainer}>
          {product.discountPrice ? (
            <>
              <Text style={styles.discountPrice}>${product.discountPrice}</Text>
              <Text style={styles.originalPrice}>${product.price}</Text>
            </>
          ) : (
            <Text style={styles.price}>${product.price}</Text>
          )}
        </View>
        
        {showActions && (
          <View style={styles.actionsContainer}>
            <Pressable style={styles.heartButton}>
              {/* <Heart size={20} color="#5a9ea6" /> */}
              <Icon name="heart" size={24} color="#5a9ea6"  />

            </Pressable>
            
            <View style={styles.buttonsContainer}>
              <Pressable 
                style={styles.addToBasketButton}
                onPress={handleAddToBasket}
              >
                <Text style={styles.buttonText}>
                  Add To Basket
                </Text>
              </Pressable>
              
              <Pressable 
                style={styles.buyNowButton}
                onPress={navigateToProduct}
              >
                <Text style={styles.buttonText}>Buy Now</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    width: '100%',
  },
  imageContainer: {
    height: 200,
    width: '100%',
    backgroundColor: '#fff',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  infoContainer: {
    padding: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  subcategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e74c3c',
  },
  discountPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e74c3c',
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heartButton: {
    padding: 8,
    borderRadius: 4,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  addToBasketButton: {
    backgroundColor: '#5a9ea6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  buyNowButton: {
    backgroundColor: '#5a9ea6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
});