import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, Image, Animated, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSegments } from 'expo-router';
import DashboardEmbed from './DashboardEmbed';
import { API_URL } from '@/constants/Api';
import { useBasket } from './BasketContext';
import { useWishlist } from './WishlistContext';

const { width: viewportWidth } = Dimensions.get('window');

// Function to fetch product data from the API
const fetchProducts = async () => {
  try {
    const response = await fetch(`${API_URL}/products`); // current product api endpoint
    const data = await response.json();
    return Array.isArray(data) ? data : []; // Ensure the result is always an array
  } catch (error) {
    console.error(error);
    return [];
  }
};

const renderCarouselItem = ({ item }: { item: any }) => {
  console.log("Carousel Item Image URL:", item.link_image);  // Log to check image URL
  return (
    <View style={styles.carouselItem}>
      <Image source={{ uri: item.link_image }} style={styles.carouselItemImage} />
      <View style={styles.carouselItemContent}>
        <Text style={styles.carouselItemName}>{item.product_name}</Text>
        <Text style={styles.carouselItemPrice}>${item.current_price}</Text>
        <TouchableOpacity style={styles.carouselButton}>
          <Text style={styles.carouselButtonText}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const flatListRef = useRef<FlatList>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [bigItemsData, setBigItemsData] = useState<any[]>([]); // Initialize state for bigItemsData
  const [basketData, setBasketData] = useState<any[]>([]);     // Initialize state for basketData
  const animatedScroll = useRef(new Animated.Value(0)).current;
  const itemWidth = viewportWidth * 0.3; // Adjust item width
  const segments = useSegments();

  const addToBasket = async (item: any) => {
    console.log('Adding basket item', item);
    const url = 'http://localhost:3000/api/baskets/addtobasket';
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      console.warn('Attempted to add to basket without a token');
      return;
    }
    const payload = {
      product_id: item.product_id,
      quantity: 1,
    };
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      await response.json().catch(() => {});
      await getBasket();
    } catch (err) {
      console.error('Error adding to basket:', err);
    }
  };

  const getBasket = async () => {
    console.log("Getting basket items");
    const url = 'http://localhost:3000/api/baskets/getbasket';
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      return;
    }

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        setBasketData(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error(err.message));
  };

  const doesItemExistInBasket = (item: any) => {
    if(!Array.isArray(basketData)) return false;
    const basketItem = basketData?.find(currentItem => item.product_id === currentItem.productId);
    return basketItem != null;
  };

  const handleScroll = (newOffset: number) => {
    Animated.timing(animatedScroll, {
      toValue: newOffset,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setScrollOffset(newOffset);
    });
  };

  const handleNext = () => {
    const newOffset = scrollOffset + itemWidth;
    const maxOffset = (bigItemsData.length - 2) * itemWidth;
    if (newOffset <= maxOffset) {
      handleScroll(newOffset);
    }
  };

  const handlePrev = () => {
    const newOffset = Math.max(scrollOffset - itemWidth, 0);
    handleScroll(newOffset);
  };

  useEffect(() => {
    getBasket();
    // getWishlist();
  }, [segments]);

  useEffect(() => {
    const fetchAndSetProducts = async () => {
      const products = await fetchProducts();
      setBigItemsData(products);
    };
    fetchAndSetProducts();
  }, []);

  useEffect(() => {
    animatedScroll.addListener(({ value }) => {
      flatListRef.current?.scrollToOffset({ offset: value, animated: false });
    });
    return () => {
      animatedScroll.removeAllListeners();
    };
  }, [animatedScroll]);

  const renderBigItem = ({ item }: { item: any }) => {
    const shouldDisableAddToBasket = doesItemExistInBasket(item);
    // const shouldDisableAddToWishlist = doesItemExistInWishlist(item);
    return (
      <View style={styles.bigItem}>
        <Image source={{ uri: item.link_image }} style={styles.bigItemImage} />
        <View style={styles.bigItemContent}>
          <Text style={styles.bigItemName}>{item.product_name}</Text>
          <Text style={styles.bigItemDescription}>{item.sub_category_1}</Text>
          <Text style={styles.bigItemPrice}>${item.current_price}</Text>
          <View style={styles.bigItemButtons}>
            {/* <TouchableOpacity disabled={shouldDisableAddToWishlist} onPress={() => addToWishlist(item)} style={shouldDisableAddToWishlist ? styles.bigItemButtonSaveDisabled : styles.bigItemButtonSave}>
              <Icon name="heart" size={16} color="#fff" />
            </TouchableOpacity> */}
          </View>
          <View style={styles.bigItemButtons}>
            <TouchableOpacity
              disabled={shouldDisableAddToBasket}
              onPress={() => addToBasket(item)}
              style={shouldDisableAddToBasket ? styles.bigItemButtonBasketDisabled : styles.bigItemButtonBasket}
            >
              <Text style={styles.bigItemButtonText}>Add To Basket</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bigItemButton}>
              <Text style={styles.bigItemButtonText}>Buy Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Split the bigItems into first two main items and the rest in carousel
  const bigItems = bigItemsData.slice(0, 5);
  const carouselItems = bigItemsData.slice(2);

  return (
    <ScrollView style={styles.scrollView}>  
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to DiscountMate</Text>
        <FlatList
          data={bigItems}
          renderItem={renderBigItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.bigItemsContainer}
          horizontal
          showsHorizontalScrollIndicator={false}
        />
        <Text style={styles.subTitle}>Explore our current deals</Text>
        <View style={styles.carouselContainer}>
          <TouchableOpacity style={[styles.arrowButton, styles.arrowButtonLeft]} onPress={handlePrev}>
            <Icon name="chevron-left" size={24} color="#000" />
          </TouchableOpacity>
          <FlatList
            ref={flatListRef}
            data={carouselItems}
            renderItem={renderCarouselItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.carouselContentContainer}
            getItemLayout={(data, index) => ({
              length: itemWidth,
              offset: itemWidth * index,
              index,
            })}
          />
          <TouchableOpacity style={[styles.arrowButton, styles.arrowButtonRight]} onPress={handleNext}>
            <Icon name="chevron-right" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>
      <DashboardEmbed />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  title: {
    textAlign: 'center',
    fontSize: 24,
    color: '#6595a3',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subTitle: {
    fontSize: 22,
    color: '#6595a3',
    marginBottom: 20,
  },
  carouselContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  carouselContentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Added base arrowButton style to avoid undefined property errors.
  arrowButton: {
    padding: 10,
  },
  arrowButtonLeft: {
    padding: 10,
  },
  arrowButtonRight: {
    padding: 10,
  },
  bigItemsContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  bigItem: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 20,
    width: 400,
    height: 230,
  },
  bigItemImage: {
    width: 200,
    height: '100%',
  },
  bigItemContent: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  bigItemName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  bigItemDescription: {
    fontSize: 10,
    marginVertical: 5,
  },
  bigItemPrice: {
    fontSize: 18,
    color: '#ff5733',
    fontWeight: 'bold',
    marginBottom: 50,
  },
  bigItemButtons: {
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bigItemButtonSave: {
    backgroundColor: '#6595a3',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  bigItemButtonSaveDisabled: {
    backgroundColor: '#ddd',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  bigItemButtonBasket: {
    backgroundColor: '#6595a3',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  bigItemButtonBasketDisabled: {
    backgroundColor: '#ddd',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  bigItemButton: {
    backgroundColor: '#6595a3',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  bigItemButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  carouselItem: {
    width: viewportWidth * 0.23,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    height: 180,
    padding: 10,
    marginHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselItemImage: {
    width: '100%',
    height: 80,
    resizeMode: 'contain',
  },
  carouselItemContent: {
    flex: 1,
    alignItems: 'center',
  },
  carouselItemName: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  carouselItemPrice: {
    fontSize: 14,
    color: '#ff5733',
    marginVertical: 5,
  },
  carouselButton: {
    backgroundColor: '#6595a3',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  carouselButtonText: {
    color: '#fff',
    fontSize: 12,
  },
});