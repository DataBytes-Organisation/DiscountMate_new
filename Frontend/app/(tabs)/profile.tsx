import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, useNavigation } from 'expo-router';
import { useState } from 'react';
import { Button, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// Temporary variable for testing
const isUserLoggedIn = true; // Set this to false to test login/signup scenario

export default function Profile() {
  const [image, setImage] = useState<string | null>(null);
  const navigation = useNavigation();
  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    console.log(result);

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSignOut = () => {
    // Implement sign out logic here
    console.log('User signed out');
    // You would typically reset the isUserLoggedIn state here
    // and navigate to the home page or login page
    // navigation.navigate('index');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile Page</Text>
      {isUserLoggedIn ? (
        <View style={styles.loggedInContainer}>
          {/* Add more profile content here, need to connect to backend*/}
          <View style={styles.profileInfo}>
            <View style={styles.container}>
              <Button title="Pick an image from camera roll" onPress={pickImage} />
              {image && <Image source={{ uri: image }} style={styles.image} />}

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
    width: 200,
    height: 200,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
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