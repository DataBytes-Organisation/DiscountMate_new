import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image } from 'react-native';
import { Link, router } from 'expo-router';
import Icon from 'react-native-vector-icons/FontAwesome';
import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import { useAuth } from '@/app/(tabs)/AuthContext';
import BrowseProductsDropdown from '@/app/(tabs)/BrowseProductsDropdown';

export default function Header({ searchQuery, setSearchQuery, unreadCount, toggleNotifications }) {
  const { isAuthenticated, logout } = useAuth();

  const handleSearch = () => {
    if (searchQuery.trim() !== '') {
      router.push(`/search?query=${searchQuery}`);
    }
  };

  const handleSignOut = () => {
    logout();
    console.log('User signed out');
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.push('/')}>
        <Image 
          source={require('@/assets/images/logo.png')} 
          style={styles.logo}
        />
      </TouchableOpacity>
      <BrowseProductsDropdown onSelectCategory={(category) => {
        console.log('Selected category:', category);
        router.push(`/category/${category}`);
      }} />
      <View style={styles.searchContainer}>
        <View style={styles.searchBoxWrapper}>
          <Icon name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchBox}
            placeholder="Search..."
            placeholderTextColor="#888"
            value={searchQuery} 
            onChangeText={setSearchQuery} 
            onSubmitEditing={handleSearch}
          />
        </View>
      </View>

      <View style={styles.headerIcons}>
        {isAuthenticated ? ( 
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        ) : (
          <Link href="/login" style={styles.loginSignupButton}>
            <Text style={styles.loginSignupText}>Login/Signup</Text>
          </Link>
        )}
        <TouchableOpacity onPress={toggleNotifications} style={styles.iconButton}>
          <TabBarIcon name="notifications-outline" color="#000" />
          {unreadCount > 0 && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/profile')} style={styles.iconButton}>
          <TabBarIcon name="person-outline" color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {   
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingHorizontal: 10,
    justifyContent: 'space-between',
    height: 60, 
    zIndex: 100, 
  },
  logo: {
    width: 100, 
    height: 180,  
    resizeMode: 'contain', 
  },
  searchContainer: {
    flex: 1,
    alignItems: 'center',
    position: 'relative', 
  },
  searchBoxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    height: 40,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchBox: {
    flex: 1,  
    height: '100%',
  },
  headerIcons: {
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  loginSignupButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    marginRight: 10,
  },
  loginSignupText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  signOutButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    marginRight: 10,
  },
  signOutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: 'red',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});