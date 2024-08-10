import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';

const blogPosts = [
  {
    title: 'Top 10 Grocery Saving Tips',
    date: 'August 7, 2024',
    image: 'https://via.placeholder.com/150',
    description: 'Learn the best tips to save on your grocery shopping every week.',
  },
  {
    title: 'Healthy Eating on a Budget',
    date: 'August 5, 2024',
    image: 'https://via.placeholder.com/150',
    description: 'Discover how you can eat healthy without breaking the bank.',
  },
  // Add more blog posts here
];

const newsArticles = [
  {
    title: 'DiscountMate Launches New Features',
    date: 'August 6, 2024',
    image: 'https://via.placeholder.com/150',
    description: 'We have launched new features to help you save more on groceries.',
  },
  {
    title: 'Grocery Price Trends in 2024',
    date: 'August 4, 2024',
    image: 'https://via.placeholder.com/150',
    description: 'A look at how grocery prices have changed over the year.',
  },
  // Add more news articles here
];

export default function BlogNews() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>Blog & News</Text>
      
      <Text style={styles.sectionTitle}>Blog</Text>
      {blogPosts.map((post, index) => (
        <View key={index} style={styles.post}>
          <Image source={{ uri: post.image }} style={styles.image} />
          <View style={styles.textContainer}>
            <Text style={styles.postTitle}>{post.title}</Text>
            <Text style={styles.postDate}>{post.date}</Text>
            <Text style={styles.postDescription}>{post.description}</Text>
          </View>
        </View>
      ))}
      
      <Text style={styles.sectionTitle}>News</Text>
      {newsArticles.map((article, index) => (
        <View key={index} style={styles.article}>
          <Image source={{ uri: article.image }} style={styles.image} />
          <View style={styles.textContainer}>
            <Text style={styles.articleTitle}>{article.title}</Text>
            <Text style={styles.articleDate}>{article.date}</Text>
            <Text style={styles.articleDescription}>{article.description}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  post: {
    backgroundColor: '#ffffff',
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  article: {
    backgroundColor: '#ffffff',
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  image: {
    width: 100,
    height: 100,
  },
  textContainer: {
    flex: 1,
    padding: 10,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  postDate: {
    fontSize: 14,
    color: '#888',
    marginVertical: 4,
  },
  articleDate: {
    fontSize: 14,
    color: '#888',
    marginVertical: 4,
  },
  postDescription: {
    fontSize: 16,
  },
  articleDescription: {
    fontSize: 16,
  },
});
