import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useAuth } from './AuthContext';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
];

export default function BlogNews() {
  const { isAuthenticated } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [modalType, setModalType] = useState<'Blog' | 'News'>('Blog');
  const [heading, setHeading] = useState<string>('');
  const [content, setContent] = useState<string>('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        const response = await axios.get('http://localhost:5000/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });

        setUser(response.data);
        setIsAdmin(response.data.admin === true);
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated]);

  const openModal = (type: 'Blog' | 'News') => {
    setModalType(type);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setHeading('');
    setContent('');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>Blog & News</Text>
      
      <View style={styles.headerContainer}>
        <Text style={styles.sectionTitle}>Blog</Text>
        {isAuthenticated && (
          <TouchableOpacity style={styles.addButton} onPress={() => openModal('Blog')}>
            <Text style={styles.addButtonText}>Add Blog</Text>
          </TouchableOpacity>
        )}
      </View>
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
      
      <View style={styles.headerContainer}>
        <Text style={styles.sectionTitle}>News</Text>
        {isAuthenticated && isAdmin && (
          <TouchableOpacity style={styles.addButton} onPress={() => openModal('News')}>
            <Text style={styles.addButtonText}>Add News</Text>
          </TouchableOpacity>
        )}
      </View>
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

      {/* Modal for adding Blog/News */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
              <Text style={styles.closeButtonText}>X</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add {modalType}</Text>
            <TextInput
              style={styles.input}
              placeholder={`${modalType} Heading`}
              value={heading}
              onChangeText={setHeading}
            />
            <TextInput
              style={styles.textArea}
              placeholder={`${modalType} Data`}
              multiline={true}
              numberOfLines={4}
              value={content}
              onChangeText={setContent}
            />
            <TouchableOpacity style={styles.submitButton} onPress={() => alert(`Submitting ${modalType}`)}>
              <Text style={styles.submitButtonText}>Submit {modalType}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  addButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#ff0000',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    padding: 10,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 20,
  },
  textArea: {
    width: '100%',
    padding: 10,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 20,
    height: 100,
  },
  submitButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
