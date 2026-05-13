import { Tabs, usePathname } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Button } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider } from './AuthContext';
import { BasketProvider } from './BasketContext';
import { WishlistProvider } from './WishlistContext';
import NotifBell, { sendTestNotification, loadNotifications } from "./notifications"
import Chatbot from './Chatbot';
import { ToastProvider } from 'react-native-toast-notifications';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';

const { width: viewportWidth } = Dimensions.get('window');

// Updated fetch function with optional query parameter for search
const fetchProducts = async (query = '') => {
  try {
    const response = await fetch(`http://localhost:3000/api/products?search=${query}`);
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
      <BasketProvider>
        <WishlistProvider>
          <ToastProvider
            placement="top"
            duration={3000}
            animationType="slide-in"
          >
            <TabLayoutContent />
          </ToastProvider>
        </WishlistProvider>
      </BasketProvider>
    </AuthProvider>
  );
}

function TabLayoutContent() {
  const colorScheme = useColorScheme();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(viewportWidth < 768);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const toggleNotifications = () => {
    setIsNotificationsVisible(!isNotificationsVisible);
  };

  useEffect(() => {
    loadNotifications(setNotifications);
  }, []);

  useEffect(() => {
    setUnreadCount(notifications.filter(notif => !notif.read).length);
  }, [notifications]);

  return (
    <View style={styles.container}>
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        unreadCount={unreadCount}
        toggleNotifications={toggleNotifications}
      />

      {isNotificationsVisible && (
        <View style={styles.notificationsPanel}>
          <Button title="send test notif" onPress={() => sendTestNotification(notifications, setNotifications)} />
          <Text style={styles.notificationsTitle}>Notifications</Text>
          <NotifBell
            notifications={notifications}
            setNotifications={setNotifications}
          />
        </View>
      )}

      <View style={styles.mainContent}>
        <Sidebar isSidebarCollapsed={isSidebarCollapsed} toggleSidebar={toggleSidebar} />

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
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    padding: 10,
  },
});

