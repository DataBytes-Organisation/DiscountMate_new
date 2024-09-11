import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, Image, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const { width: viewportWidth } = Dimensions.get('window');

// Main Home page displaying the main dashboard
const data = [
  { key: '1', title: 'test item1', text: 'Description of Item 1' },
  { key: '2', title: 'test item', text: 'Description of Item 2' },
  { key: '3', title: 'test item1', text: 'Description of Item 3' },
  { key: '4', title: 'test item1', text: 'Description of Item 4' },
  { key: '5', title: 'test item1', text: 'Description of Item 5' },
  { key: '6', title: 'test item1', text: 'Description of Item 6' },
  { key: '7', title: 'test item1', text: 'Description of Item 7' },
  { key: '8', title: 'test item1', text: 'Description of Item 8' },
  { key: '9', title: 'test item1', text: 'Description of Item 9' },
];

const bigItemsData = [
  {
    key: '1',
    name: 'Big Item 1',
    description: 'This is the description for big item 1.',
    price: '$19.99',
    image: 'https://via.placeholder.com/150',
  },
  {
    key: '2',
    name: 'Big Item 2',
    description: 'This is the description for big item 2.',
    price: '$29.99',
    image: 'https://via.placeholder.com/150',
  },
];

const renderItem = ({ item }) => (
  <View style={styles.carouselItem}>
    <Text style={styles.carouselTitle}>{item.title}</Text>
    <Text style={styles.carouselText}>{item.text}</Text>
  </View>
);

const renderBigItem = ({ item }) => (
  <View style={styles.bigItem}>
    <Image source={{ uri: item.image }} style={styles.bigItemImage} />
    <View style={styles.bigItemContent}>
      <Text style={styles.bigItemName}>{item.name}</Text>
      <Text style={styles.bigItemDescription}>{item.description}</Text>
      <Text style={styles.bigItemPrice}>{item.price}</Text>
      <View style={styles.bigItemButtons}>
        <TouchableOpacity style={styles.bigItemButtonSave}>
          <Icon name="heart" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.bigItemButtons}>
        <TouchableOpacity style={styles.bigItemButtonCart}>
          <Text style={styles.bigItemButtonText}>Add To Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bigItemButton}>
          <Text style={styles.bigItemButtonText}>Buy Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

export default function HomeScreen() {
  const flatListRef = useRef<FlatList>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const animatedScroll = useRef(new Animated.Value(0)).current;

  const itemWidth = viewportWidth * 0.3; // Adjust item width

  const handleScroll = (newOffset) => {
    Animated.timing(animatedScroll, {
      toValue: newOffset,
      duration: 300, // Animation duration (ms)
      useNativeDriver: false,
    }).start(() => {
      setScrollOffset(newOffset);
    });
  };

  const handleNext = () => {
    const newOffset = scrollOffset + itemWidth;
    const maxOffset = (data.length - 1) * itemWidth;
    if (newOffset <= maxOffset) {
      handleScroll(newOffset);
    }
  };

  const handlePrev = () => {
    const newOffset = Math.max(scrollOffset - itemWidth, 0);
    handleScroll(newOffset);
  };

  useEffect(() => {
    // Synchronize FlatList scrolling with the animated value
    animatedScroll.addListener(({ value }) => {
      flatListRef.current?.scrollToOffset({ offset: value, animated: false });
    });

    return () => {
      animatedScroll.removeAllListeners();
    };
  }, [animatedScroll]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to DiscountMate</Text>

      <FlatList
        data={bigItemsData}
        renderItem={renderBigItem}
        keyExtractor={(item) => item.key}
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
          data={data}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    paddingHorizontal: 20,
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
  }, carouselContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  carouselContentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselItem: {
    width: viewportWidth * 0.23,
    backgroundColor: 'lightgray',
    borderRadius: 10,
    height: 150,
    padding: 20,
    marginHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  carouselText: {
    fontSize: 16,
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
  bigItemButtonCart: {
    backgroundColor: '#6595a3',
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
});
