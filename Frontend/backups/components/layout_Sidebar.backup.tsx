import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/FontAwesome';
import { TabBarIcon } from '@/components/navigation/TabBarIcon';

export default function Sidebar({ isSidebarCollapsed, toggleSidebar }) {
  return (
    <View style={[styles.sidebar, isSidebarCollapsed ? styles.sidebarCollapsed : null]}>
      <TouchableOpacity onPress={toggleSidebar} style={styles.toggleButton}>
        <Icon name={isSidebarCollapsed ? "arrow-right" : "arrow-left"} size={15} color="#888" />
      </TouchableOpacity>
      {!isSidebarCollapsed && (
        <View style={styles.sidebarButtons}>
          <TouchableOpacity onPress={() => router.push('/')} style={styles.iconButton}>
            <TabBarIcon name="home-outline" color="#000" />
            <Text style={styles.iconButtonText}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/productpage')} style={styles.iconButton}>
            <TabBarIcon name="search" color="#000" />
            <Text style={styles.iconButtonText}>Product Page</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')} style={styles.iconButton}>
            <TabBarIcon name="person-outline" color="#000" />
            <Text style={styles.iconButtonText}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/basketsummary')} style={styles.iconButton}>
            <TabBarIcon name="basket-outline" color="#000" />
            <Text style={styles.iconButtonText}>My Basket</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/wishlist')} style={styles.iconButton}>
            <TabBarIcon name="heart-outline" color="#000" />
            <Text style={styles.iconButtonText}>My Wishlist</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/contact')} style={styles.iconButton}>
            <TabBarIcon name="call-outline" color="#000" />
            <Text style={styles.iconButtonText}>Contact Us</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/blog')} style={styles.iconButton}>
            <TabBarIcon name="document-text-outline" color="#000" />
            <Text style={styles.iconButtonText}>Blog</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 150,
    paddingVertical: 20,
    borderRightColor: "white",
    paddingHorizontal: 13,
    backgroundColor: '#f8f8f8',
    borderRightWidth: 1,
    position: 'relative',
  },
  sidebarCollapsed: {
    borderRightColor: "white",
    width: 20,
    backgroundColor: "whitw",
  },
  toggleButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  sidebarButtons: {
    marginTop: 35,
    flexDirection: 'column',
    gap: 20,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButtonText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#000',
  },
});
