import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity } from 'react-native';

const { width: viewportWidth } = Dimensions.get('window');
//Main Home  page displaying the main dashboard 

const data = [
  { key: '1', title: 'test item1', text: 'Description of Item 1' },
  { key: '2', title: 'test item', text: 'Description of Item 2' },
  { key: '3', title: 'test item1', text: 'Description of Item 3' },
  { key: '4', title: 'test item1', text: 'Description of Item 4' },
  { key: '5', title: 'test item1', text: 'Description of Item 5' },
  { key: '6', title: 'test item1', text: 'Description of Item 6' },
  { key: '7', title: 'test item1', text: 'Description of Item 7' },
  { key: '8', title: 'test item1', text: 'Description of Item 8' },
];

const renderItem = ({ item }) => (
  <View style={styles.carouselItem}>
    <Text style={styles.carouselTitle}>{item.title}</Text>
    <Text style={styles.carouselText}>{item.text}</Text>
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
      <Text style={styles.title}>Dashboard</Text>
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
          keyExtractor={item => item.key}
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
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
    width: viewportWidth * 0.3,
    backgroundColor: 'lightgray',
    borderRadius: 5,
    height: 150,
    padding: 20,
    marginHorizontal: 5,
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
});
