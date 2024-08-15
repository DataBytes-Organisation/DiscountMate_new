import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, useNavigation } from 'expo-router';

// Temporary variable for testing
const isUserLoggedIn = false; // Set this to false to test login/signup scenario

export default function Profile() {
  const navigation = useNavigation();

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
          <Text style={styles.message}>User is logged in</Text>
          {/* Add more profile content here */}
          <View style={styles.profileInfo}>
            <Text style={styles.infoText}>Name: John Doe</Text>
            <Text style={styles.infoText}>Email: john.doe@example.com</Text>
            <Text style={styles.infoText}>Member since: January 1, 2023</Text>
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