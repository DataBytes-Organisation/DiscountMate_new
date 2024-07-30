
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Blog() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Blog Page</Text>
      {/* Add blog page content here */}
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
