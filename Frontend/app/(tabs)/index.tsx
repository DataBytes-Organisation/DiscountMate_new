/**
 * Skeletal Homepage - Minimal version for new design
 * Replace this with your new homepage content
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
   return (
      <View style={styles.container}>
         <Text style={styles.title}>Welcome to DiscountMate</Text>
         <Text style={styles.subtitle}>Your new homepage starts here</Text>
      </View>
   );
}

const styles = StyleSheet.create({
   container: {
      flex: 1,
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
   },
   title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#333',
      marginBottom: 10,
   },
   subtitle: {
      fontSize: 16,
      color: '#666',
      textAlign: 'center',
   },
});
