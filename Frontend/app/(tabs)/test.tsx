import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from './AuthContext';  // Ensure you have AuthContext for authentication state
import Entypo from 'react-native-vector-icons/Entypo';

const defaultImageUri = require('@/assets/images/defaultprofileimage.png');

interface ProfileImage {
  mime: string; // MIME type of the image
  content: Buffer; // Image binary content
}

interface Profile {
  user_fname: string;
  user_lname: string;
  email: string;
  address: string;
  phone_number: string;
  profile_image?: ProfileImage | null;
}

export default function Profile() {
  const { isAuthenticated, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [image, setImage] = useState<string | null>(null);

  const getImage = (profileImage: { mime: string; content: string } | null): string => {
    if (!profileImage) {
      return defaultImageUri as string;
    }
  
    return `data:${profileImage.mime};base64,${profileImage.content}`;
  };
  
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;
  
        const response = await axios.get<Profile>('http://localhost:3000/api/users/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
  
        setProfile(response.data);
  
        if (response.data.profile_image) {
          const imageContent =
            typeof response.data.profile_image.content === 'string'
              ? response.data.profile_image.content
              : response.data.profile_image.content.toString('base64');
  
          setImage(
            getImage({
              mime: response.data.profile_image.mime,
              content: imageContent,
            })
          );
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };
  
    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated]);
  
  const handleSignOut = async () => {
    logout();
    setProfile(null);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets[0].uri) {
      const imageUri = result.assets[0].uri;
      setImage(imageUri); 
      uploadImage(imageUri, result.assets[0].fileName!);
    } else {
      console.log('Image picker was canceled');
    }
  };

  const uploadImage = async (uri: string, imageName: string) => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      console.log('No token available');
      return;
    }
  
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
  
      console.log('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileCard}>
        <Image source={{ uri: image || defaultImageUri }} style={styles.image} />
        <Text style={styles.name}>{profile?.user_fname} {profile?.user_lname}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
        <Text style={styles.phone}>{profile?.phone_number}</Text>
        <Text style={styles.address}>{profile?.address}</Text>

        <TouchableOpacity onPress={pickImage} style={styles.uploadButton}>
          <Entypo name="camera" size={24} color="#fff" />
          <Text style={styles.uploadButtonText}>Change Profile Picture</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    paddingTop: 20,
    paddingHorizontal: 16,
  },
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
  image: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#eee',
  },
  name: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  phone: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  address: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 8,
  },
  signOutButton: {
    backgroundColor: '#FF5722',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  signOutButtonText: {
    fontSize: 16,
    color: '#fff',
  },
});