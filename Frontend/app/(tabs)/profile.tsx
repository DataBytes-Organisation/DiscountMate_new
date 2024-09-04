import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, useNavigation } from 'expo-router';
import { useState } from 'react';
import { Button, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Entypo from 'react-native-vector-icons/Entypo';

const isUserLoggedIn = false; // Set this to false to test login/signup scenario

// Import the default image
const defaultImageUri = require('@/assets/images/defaultprofileimage.png');

export default function Profile() {
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

  const handleSignOut = () => {
    console.log('User signed out');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile Page</Text>
      {isUserLoggedIn ? (
        <View style={styles.loggedInContainer}>
          <View style={styles.profileInfo}>
            <View style={styles.container}>
              <Image
                source={image ? { uri: image } : defaultImageUri}
                style={styles.image}
              />
              <View style={styles.entypoContainer}>
                <Entypo name="pencil" size={30} onPress={pickImage} />
              </View>
            </View>
            <Text style={styles.infoText}>Name: John Doe</Text>
            <Text style={styles.infoText}>Email: john.doe@example.com</Text>
            <Text style={styles.infoText}>Location: Australia</Text>
            <Text style={styles.infoText}>Member since: January 1, 2024</Text>
            <Text style={styles.infoText}>Biography: 40 year old man looking for discounts for family of 4</Text>
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
  entypoContainer:{
    marginLeft: 150,
    marginTop:-20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 0,
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