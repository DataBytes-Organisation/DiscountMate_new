import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome'; // Make sure this is correctly imported


const { width: viewportWidth } = Dimensions.get('window');
//Main Home  page displaying the main dashboard 

const data = [
  { key: '1', title: 'test item1', text: 'Description of Item 1' },
  { key: '2', title: 'test item', text: 'Description of Item 2' },
  { key: '3', title: 'test item1', text: 'Description of Item 3' },
  { key: '4', title: 'test item1', text: 'Description of Item 4' },
  { key: '5', title: 'test item1', text: 'Description of Item 5' },

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
    <Image source={{ uri: item.image }} style={styles.bigItemImage} /> {/* Correct usage */}
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
  const flatListRef = useRef(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  const handleNext = () => {
    const newOffset = scrollOffset + viewportWidth * 0.3 + 10;
    flatListRef.current?.scrollToOffset({
      offset: newOffset,
      animated: true,
    });
    setScrollOffset(newOffset);
  };

  const handlePrev = () => {
    const newOffset = Math.max(scrollOffset - (viewportWidth * 0.3 + 10), 0);
    flatListRef.current?.scrollToOffset({
      offset: newOffset,
      animated: true,
    });
    setScrollOffset(newOffset);
  };

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
      
      
      <Text style={styles.subTitle}>Explore our current deals </Text>
      <View style={styles.carouselContainer}>
        <TouchableOpacity style={[styles.arrowButton, styles.arrowButtonLeft]} onPress={handlePrev}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <FlatList
          ref={flatListRef}
          data={data}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.carouselContentContainer}
          initialNumToRender={1}
          onScroll={(event) => setScrollOffset(event.nativeEvent.contentOffset.x)}
        />
        <TouchableOpacity style={[styles.arrowButton, styles.arrowButtonRight]} onPress={handleNext}>
          <Text style={styles.arrowText}>›</Text>
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
    color: "#6595a3", 
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subTitle: {
    fontSize: 22,
    color: "#6595a3", 
    marginBottom: 20,
  },
  carouselContainer: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselContentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselItem: {
    width: viewportWidth * 0.15,
    backgroundColor: 'lightgray',
    borderRadius: 5,
    height: 150,
    padding: 20,
    marginHorizontal: 30,
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
  arrowButton: {
    position: 'absolute',
    top: '50%',
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 20,
    zIndex: 1,
  },
  arrowButtonLeft: {
    left: 10,
    transform: [{ translateY: -20 }],
  },
  arrowButtonRight: {
    right: 10,
    transform: [{ translateY: -20 }],
  },
  arrowText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
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
    marginRight: 20, // Space between items
    width: 400, // Fixed width
    height: 230, // Fixed height
  },
  bigItemImage: {
    width: 200,
    height: '100%', //  image fill the height of the container
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
