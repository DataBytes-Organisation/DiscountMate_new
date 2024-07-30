import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Contact() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contact Us Page</Text>
      {/* Add Some content for contact us here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
