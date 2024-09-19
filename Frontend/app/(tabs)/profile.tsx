import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';  // Use Linking for navigation
import { useAuth } from './AuthContext';  // Import useAuth from AuthContext
import { Button, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Entypo from 'react-native-vector-icons/Entypo';

// Import the default image
const defaultImageUri = require('@/assets/images/defaultprofileimage.png');

// Define the type for the profile data
interface Profile {
  user_fname: string;
  user_lname: string;
  email: string;
  address: string;
  phone_number: string;
}

export default function Profile() {
  const { isAuthenticated, logout } = useAuth(); // Get isAuthenticated and logout from AuthContext
  const [profile, setProfile] = useState<Profile | null>(null);

  // Fetch profile data when component mounts
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Get token from AsyncStorage
        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
          return;
        }

        // Make API call to get profile data
        const response = await axios.get<Profile>('http://localhost:5000/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });

        setProfile(response.data);
      } catch (error) {
        console.log('Error fetching profile:', error);
      }
    };

    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated]);

  const handleSignOut = async () => {
    logout(); // Use logout from AuthContext to handle sign out
    setProfile(null);
  };
  const [image, setImage] = useState<string | null>(null);
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile Page</Text>
      {isAuthenticated && profile ? (
        <View style={styles.loggedInContainer}>
          <Image
            source={image ? { uri: image } : defaultImageUri}
            style={styles.image}
          />
          <View style={styles.entypoContainer}>
            <Entypo name="pencil" size={30} onPress={pickImage} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.infoText}>First Name: {profile.user_fname}</Text>
            <Text style={styles.infoText}>Last Name: {profile.user_lname}</Text>
            <Text style={styles.infoText}>Email: {profile.email}</Text>
            <Text style={styles.infoText}>Address: {profile.address}</Text>
            <Text style={styles.infoText}>Phone Number: {profile.phone_number}</Text>
          </View>
          <TouchableOpacity style={styles.button} onPress={handleSignOut}>
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.loggedOutContainer}>
          <Text style={styles.message}>Please log in or sign up to view your profile</Text>
          <Link href="/login" asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>Login/Signup</Text>
            </TouchableOpacity>
          </Link>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: 160,
    height: 160,
    borderRadius: 100,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 7,
  },
  entypoContainer: {
    marginLeft: 150,
    marginTop: -20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  loggedInContainer: {
    alignItems: 'center',
    width: '100%',
  },
  loggedOutContainer: {
    alignItems: 'center',
  },
  message: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  profileInfo: {
    width: '100%',
    backgroundColor: '#f0f0f0',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});