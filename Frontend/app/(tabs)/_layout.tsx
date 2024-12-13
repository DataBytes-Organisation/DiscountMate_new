import { Tabs, useNavigation, Link } from 'expo-router'; 
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Dimensions, ScrollView, Button } from 'react-native';
import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import { Colors } from '@/constants/Colors';
import { Image } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome'; 
import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from './AuthContext'; 
import NotifBell, { sendTestNotification,  BellNotification, loadNotifications } from "./notifications"
import BrowseProductsDropdown from './BrowseProductsDropdown';
import Chatbot from './Chatbot'; 

const { width: viewportWidth } = Dimensions.get('window');

// Updated fetch function with optional query parameter for search
const fetchProducts = async (query = '') => {
  try {
    const response = await fetch(`http://localhost:5000/products?search=${query}`); 
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    return [];
  }
};

// Simulated loadNotifications function
// const loadNotifications = async (setNotifications) => {
//   // Simulate fetching notifications from an API or database
//   const simulatedNotifications = [
//     { id: 1, message: 'New product available', read: false },
//     { id: 2, message: 'Your order has been shipped', read: true },
//     { id: 3, message: 'Discount on selected items', read: false },
//   ];
//   setNotifications(simulatedNotifications);
// };

export default function TabLayout() {
  return (
    <AuthProvider>
      <TabLayoutContent />
    </AuthProvider>
  );
}

function TabLayoutContent() {
  const colorScheme = useColorScheme();
  const navigation = useNavigation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(viewportWidth < 768);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const { isAuthenticated, logout } = useAuth(); 
  const [searchQuery, setSearchQuery] = useState(''); 
  const [searchResults, setSearchResults] = useState([]); 
  const [isFetching, setIsFetching] = useState(false);
  const [notifications, setNotifications] = useState([]); // Define notifications state
  const [unreadCount, setUnreadCount] = useState(0); // Define unreadCount state

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const toggleNotifications = () => {
    setIsNotificationsVisible(!isNotificationsVisible);
  };

  useEffect(() => {
    // Call the simulated loadNotifications function
    loadNotifications(setNotifications);
  }, []);

  useEffect(() => {
    // Update unread count whenever notifications change
    setUnreadCount(notifications.filter(notif => !notif.read).length);
  }, [notifications]);

  const handleSignOut = () => {
    logout(); 
    console.log('User signed out');
  };

  // Fetch products based on the search query
  const fetchAndSetProducts = useCallback(async () => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }

    setIsFetching(true);  
    const products = await fetchProducts(searchQuery); 
    setSearchResults(products);
    setIsFetching(false); 
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery) {
      const timeoutId = setTimeout(fetchAndSetProducts, 300); 
      return () => clearTimeout(timeoutId); 
    } else {
      setSearchResults([]); 
    }
  }, [searchQuery, fetchAndSetProducts]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('index')}>
          <Image 
            source={require('@/assets/images/logo.png')} 
            style={styles.logo}
          />
        </TouchableOpacity>
        <BrowseProductsDropdown onSelectCategory={(category) => {
    // Handle category selection here
         console.log('Selected category:', category);
    // You might want to update your search or navigate to a category page
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
            />
          </View>

          {/* Display the search results box when there's input in the search bar */}
          {searchQuery.trim() !== '' && (
            <View style={styles.searchResultsContainer}>
              <ScrollView style={styles.searchResultsBox}>
                {isFetching ? (
                  <Text style={styles.noResultsText}>Searching...</Text>
                ) : searchResults.length > 0 ? (
                  searchResults.map((product, index) => (
                    <TouchableOpacity key={index} style={styles.resultItem} onPress={() => navigation.navigate('product', { id: product._id })}>
                      <Text>{product.product_name}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noResultsText}>No products found</Text>
                )}
              </ScrollView>
            </View>
          )}
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
          <TouchableOpacity onPress={() => navigation.navigate('profile')} style={styles.iconButton}>
            <TabBarIcon name="person-outline" color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {isNotificationsVisible && (
        <View style={styles.notificationsPanel}>
          <Button title="send test notif" onPress={() => sendTestNotification(notifications, setNotifications)} //delete this when no longer needed for testing
            />
          <Text style={styles.notificationsTitle}>Notifications</Text>
          <NotifBell
            notifications={notifications}
            setNotifications={setNotifications}
          />
        </View>
      )}

      <View style={styles.mainContent}>
        <View style={[styles.sidebar, isSidebarCollapsed ? styles.sidebarCollapsed : null]}>
          <TouchableOpacity onPress={toggleSidebar} style={styles.toggleButton}>
            <Icon name={isSidebarCollapsed ? "arrow-right" : "arrow-left"} size={15} color="#888" />
          </TouchableOpacity>
          {!isSidebarCollapsed && (
            <View style={styles.sidebarButtons}>
              <TouchableOpacity onPress={() => navigation.navigate('index')} style={styles.iconButton}>
                <TabBarIcon name="home-outline" color="#000" />
                <Text style={styles.iconButtonText}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('profile')} style={styles.iconButton}>
                <TabBarIcon name="person-outline" color="#000" />
                <Text style={styles.iconButtonText}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('basketsummary')} style={styles.iconButton}>
                <TabBarIcon name="basket-outline" color="#000" />
                <Text style={styles.iconButtonText}>My Basket</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('contact')} style={styles.iconButton}>
                <TabBarIcon name="call-outline" color="#000" />
                <Text style={styles.iconButtonText}>Contact Us</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('blog')} style={styles.iconButton}>
                <TabBarIcon name="document-text-outline" color="#000" />
                <Text style={styles.iconButtonText}>Blog</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('calender')} style={styles.iconButton}>
                <Icon name="calendar" size={20} color="#000" />
                <Text style={styles.iconButtonText}>Calendar</Text>
              </TouchableOpacity>

            </View>
          )}
        </View>

        <View style={styles.content}>
          <Tabs
            screenOptions={{
              tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
              headerShown: false,
              tabBarStyle: { display: 'none' },
            }}
          >
          </Tabs>
        </View>
      </View>
      <Chatbot />
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
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
  searchResultsContainer: {
    position: 'absolute',
    top: 50, 
    width: '80%',
    zIndex: 2000, 
  },
  searchResultsBox: {
    maxHeight: 200, 
    backgroundColor: '#fff',
    borderRadius: 5,
    borderColor: '#ddd',
    borderWidth: 1,
    padding: 10,
  },
  resultItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  noResultsText: {
    textAlign: 'center',
    color: '#888',
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
  notificationsPanel: {
    position: 'absolute',
    top: 60,
    right: 10,
    width: 250,
    backgroundColor: '#fff',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    zIndex: 1000,
  },
  notificationsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  notificationItem: {
    fontSize: 14,
    paddingVertical: 5,
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
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
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
  content: {
    flex: 1,
    padding: 10,
  },
});