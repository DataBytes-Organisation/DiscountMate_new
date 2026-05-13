import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Modal, Pressable } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../(tabs)/AuthContext';
 // make sure AuthContext exists
import Entypo from 'react-native-vector-icons/Entypo';
import { useToast } from 'react-native-toast-notifications';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

const defaultImageUri = require('@/assets/images/defaultprofileimage.png');

interface ProfileImage {
  mime: string;
  content: Buffer;
}

interface Profile {
  email: string;
  user_fname: string;
  user_lname: string;
  address: string;
  phone_number: string;
  persona?: string;
  profile_image?: ProfileImage | null;
}

export default function Profile() {
  const navigation = useNavigation();
  const route = useRoute();
  const { isAuthenticated, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const toast = useToast();

  const getImage = (profileImage: { mime: string; content: string } | null): string => {
    if (!profileImage) return defaultImageUri as string;
    return `data:${profileImage.mime};base64,${profileImage.content}`;
  };

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await axios.get<Profile>('http://localhost:3000/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProfile(response.data);

      if (response.data.profile_image) {
        const imageContent =
          typeof response.data.profile_image.content === 'string'
            ? response.data.profile_image.content
            : response.data.profile_image.content.toString('base64');

        setImage(getImage({ mime: response.data.profile_image.mime, content: imageContent }));
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchProfile();
  }, [isAuthenticated]);

  useFocusEffect(
    React.useCallback(() => {
      if (route.params?.updatedProfile) {
        setProfile(route.params.updatedProfile);
      } else {
        fetchProfile();
      }
    }, [route.params])
  );

  const handleSignOut = async () => {
    logout();
    setProfile(null);
    toast.show('Signed out successfully!', { type: 'success', placement: 'top' });
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets[0].uri) {
      const imageUri = result.assets[0].uri;
      setImage(imageUri);
      await uploadImage(imageUri, result.assets[0].fileName!);
      setModalVisible(true);
    }
  };

  const uploadImage = async (uri: string, imageName: string) => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append('image', blob, imageName);

      await axios.post('http://localhost:3000/api/users/upload-profile-image', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileCard}>
        <Image source={{ uri: image || defaultImageUri }} style={styles.image} />

        <TouchableOpacity onPress={pickImage} style={styles.uploadButton}>
          <Entypo name="camera" size={24} color="#fff" />
          <Text style={styles.uploadButtonText}>Change Profile Picture</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} style={styles.editProfileButton}>
          <Text style={styles.editProfileButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>Profile picture uploaded successfully!</Text>
            <Pressable style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f2', paddingTop: 20, paddingHorizontal: 16 },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 20,
  },
  image: { width: 120, height: 120, borderRadius: 60, marginBottom: 20, borderWidth: 3, borderColor: '#eee' },
  name: { fontSize: 22, fontWeight: '600', color: '#333', marginBottom: 8 },
  email: { fontSize: 16, color: '#666', marginBottom: 4 },
  persona: { fontSize: 16, color: '#666', marginBottom: 4 },
  phone: { fontSize: 16, color: '#666', marginBottom: 4 },
  address: { fontSize: 16, color: '#666', marginBottom: 16, textAlign: 'center' },
  uploadButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CAF50', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginBottom: 20 },
  uploadButtonText: { fontSize: 16, color: '#fff', marginLeft: 8 },
  signOutButton: { backgroundColor: '#FF5722', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  signOutButtonText: { fontSize: 16, color: '#fff' },
  editProfileButton: { backgroundColor: '#2196F3', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginBottom: 20 },
  editProfileButtonText: { fontSize: 16, color: '#fff', textAlign: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContent: { backgroundColor: '#fff', borderRadius: 10, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalText: { fontSize: 18, fontWeight: '500', marginBottom: 20, textAlign: 'center' },
  closeButton: { backgroundColor: '#4CAF50', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  closeButtonText: { fontSize: 16, color: '#fff', textAlign: 'center' },
});
