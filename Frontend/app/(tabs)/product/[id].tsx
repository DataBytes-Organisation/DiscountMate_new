import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useNavigation  } from 'expo-router';
// import { Heart, ArrowLeft, Share2, Star, Info, ShoppingBasket, Check } from 'lucide-react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
// import Header from '@/components/Header';
// import Sidebar from '@/components/Sidebar';
import QuantitySelector from '@/components/QuantitySelector';
import Rating from '@/components/Rating';
import RelatedProducts from '@/components/Relatedproducts';
import { getProductById, getRelatedProducts } from '@/mocks/products';
// import { useBasketStore } from '@/store/basket-store';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const product = getProductById(id || '');
  const relatedProducts = getRelatedProducts(id || '');
  
  const [quantity, setQuantity] = useState(1);
  // const { addToBasket, isInBasket } = useBasketStore();
  const inBasket = false;
  
  const handleIncrease = () => {
    setQuantity(prev => Math.min(prev + 1, 99));
  };
  
  const handleDecrease = () => {
    setQuantity(prev => Math.max(prev - 1, 1));
  };
  
  const handleAddToBasket = () => {
    if (product) {
      // addToBasket(product, quantity);
      console.log("add to basket")
    }
  };
  
  const handleBuyNow = () => {
    if (product) {
      // addToBasket(product, quantity);
      console.log("Add to baset")
      router.push('/basket');
    }
  };
  
  if (!product) {
    return (
      <View style={styles.container}>
        {/* <Header showSearch={false} showBrowse={false} /> */}
        <View style={styles.content}>
          {/* <Sidebar /> */}
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Product not found</Text>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      
      {/* <Header showSearch={false} showBrowse={false} /> */}
      
      <View style={styles.content}>
        {/* <Sidebar /> */}
        
        <ScrollView style={styles.mainContent} contentContainerStyle={styles.scrollContent}>
          <View style={styles.navigation}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              {/* <ArrowLeft size={16} color="#666" /> */}
              <Icon name="angle-left" size={24} color="#666"  />

              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </View>
          
          <View style={styles.productHeader}>
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: product.image }} 
                style={styles.productImage} 
                resizeMode="cover"
              />
              <View style={styles.imageActions}>
                <Pressable style={styles.iconButton}>
                  {/* <Heart size={20} color="#5a9ea6" /> */}
                  <Icon name="heart" size={24} color="#5a9ea6"  />

                </Pressable>
                <Pressable style={styles.iconButton}>
                  {/* <Share2 size={20} color="#5a9ea6" /> */}
                  <Icon name="share" size={24} color="#5a9ea6"  />

                </Pressable>
              </View>
            </View>
            
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{product.name}</Text>
              
              <View style={styles.categoryRow}>
                <Text style={styles.category}>
                  {product.subcategory} • {product.unit}
                </Text>
                {product.isOrganic && (
                  <View style={styles.organicBadge}>
                    <Text style={styles.organicText}>Organic</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.ratingContainer}>
                <Rating 
                  value={product.rating} 
                  reviews={product.reviews} 
                />
              </View>
              
              <View style={styles.priceContainer}>
                {product.discountPrice ? (
                  <>
                    <Text style={styles.discountPrice}>${product.discountPrice}</Text>
                    <Text style={styles.originalPrice}>${product.price}</Text>
                    <View style={styles.saveBadge}>
                      <Text style={styles.saveText}>
                        Save ${(product.price - product.discountPrice).toFixed(2)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.price}>${product.price}</Text>
                )}
              </View>
              
              <View style={styles.stockContainer}>
                {product.stock > 10 ? (
                  <Text style={styles.inStock}>
                    {/* <Check size={16} color="#27ae60" />                   <Icon name="check" size={24} color="#27ae60"  /> */}
                    In Stock
                  </Text>
                ) : product.stock > 0 ? (
                  <Text style={styles.lowStock}>
                    Only {product.stock} left in stock
                  </Text>
                ) : (
                  <Text style={styles.outOfStock}>Out of Stock</Text>
                )}
              </View>
              
              <View style={styles.actionsContainer}>
                <View style={styles.quantityContainer}>
                  <Text style={styles.quantityLabel}>Quantity:</Text>
                  <QuantitySelector
                    quantity={quantity}
                    onIncrease={handleIncrease}
                    onDecrease={handleDecrease}
                  />
                </View>
                
                <View style={styles.buttonsContainer}>
                  <Pressable 
                    style={[
                      styles.addToBasketButton,
                      inBasket && styles.inBasketButton
                    ]}
                    onPress={handleAddToBasket}
                  >
                    {/* <ShoppingBasket size={16} color="white" /> */}
                    <Icon name="heart" size={24} color="#ffffff"  />

                    <Text style={styles.buttonText}>
                      {inBasket ? 'Added to Basket' : 'Add to Basket'}
                    </Text>
                  </Pressable>
                  
                  <Pressable 
                    style={styles.buyNowButton}
                    onPress={handleBuyNow}
                  >
                    <Text style={styles.buttonText}>Buy Now</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
          
          <View style={styles.descriptionContainer}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>
          
          <View style={styles.nutritionContainer}>
            <Text style={styles.sectionTitle}>Nutritional Information</Text>
            <View style={styles.nutritionTable}>
              <View style={styles.nutritionRow}>
                <Text style={styles.nutritionLabel}>Calories:</Text>
                <Text style={styles.nutritionValue}>{product.nutritionalInfo.calories} kcal</Text>
              </View>
              <View style={styles.nutritionRow}>
                <Text style={styles.nutritionLabel}>Protein:</Text>
                <Text style={styles.nutritionValue}>{product.nutritionalInfo.protein}</Text>
              </View>
              <View style={styles.nutritionRow}>
                <Text style={styles.nutritionLabel}>Fat:</Text>
                <Text style={styles.nutritionValue}>{product.nutritionalInfo.fat}</Text>
              </View>
              <View style={styles.nutritionRow}>
                <Text style={styles.nutritionLabel}>Carbohydrates:</Text>
                <Text style={styles.nutritionValue}>{product.nutritionalInfo.carbs}</Text>
              </View>
              <View style={styles.nutritionRow}>
                <Text style={styles.nutritionLabel}>Sugar:</Text>
                <Text style={styles.nutritionValue}>{product.nutritionalInfo.sugar}</Text>
              </View>
            </View>
          </View>
          
          {relatedProducts.length > 0 && (
            <RelatedProducts products={relatedProducts} />
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
  productHeader: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    marginBottom: 24,
    gap: 24,
  },
  imageContainer: {
    flex: Platform.OS === 'web' ? 1 : undefined,
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 300,
  },
  imageActions: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    padding: 8,
  },
  productInfo: {
    flex: Platform.OS === 'web' ? 1 : undefined,
  },
  productName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  category: {
    fontSize: 14,
    color: '#666',
  },
  organicBadge: {
    marginLeft: 8,
    backgroundColor: '#27ae60',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  organicText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  ratingContainer: {
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e74c3c',
  },
  discountPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e74c3c',
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  saveBadge: {
    backgroundColor: '#e74c3c',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  saveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  stockContainer: {
    marginBottom: 16,
  },
  inStock: {
    color: '#27ae60',
    fontSize: 14,
    fontWeight: '500',
  },
  lowStock: {
    color: '#f39c12',
    fontSize: 14,
    fontWeight: '500',
  },
  outOfStock: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '500',
  },
  actionsContainer: {
    marginBottom: 16,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  quantityLabel: {
    fontSize: 14,
    marginRight: 8,
    color: '#666',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  addToBasketButton: {
    flex: 1,
    backgroundColor: '#5a9ea6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    gap: 8,
  },
  inBasketButton: {
    backgroundColor: '#27ae60',
  },
  buyNowButton: {
    flex: 1,
    backgroundColor: '#e74c3c',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  descriptionContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
  },
  nutritionContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  nutritionTable: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 4,
  },
  nutritionRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  nutritionLabel: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  nutritionValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    marginBottom: 16,
  },
  backButtonText: {
    color: '#5a9ea6',
    fontSize: 16,
  },
});