import { Tabs, useNavigation, Link } from 'expo-router';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Dimensions, Button } from 'react-native';
import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import { Colors } from '@/constants/Colors';
import {  Image } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';  // Import FontAwesome icons
import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from './AuthContext'; // Import AuthProvider and useAuth
import NotifBell, { BellNotification, sendTestNotification, loadNotifications } from './notifications';


const { width: viewportWidth } = Dimensions.get('window');

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
  const { isAuthenticated, logout } = useAuth(); // Use authentication context
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<BellNotification[]>([]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const toggleNotifications = () => {
    setIsNotificationsVisible(!isNotificationsVisible);
  };

  React.useEffect(() =>{
    loadNotifications(setNotifications);
  }, []);

  React.useEffect(() => {
    setUnreadCount(notifications.filter(notifs => !notifs.read).length);
  }, [notifications]);

  const handleSignOut = () => {
    logout(); // Call logout from AuthContext
    console.log('User signed out');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>

      <TouchableOpacity onPress={() => navigation.navigate('index')}>
          <Image 
            source={require('@/assets/images/logo.png')} // Replace with your actual logo path
            style={styles.logo}
          />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <View style={styles.searchBoxWrapper}>
            <Icon name="search" size={20} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchBox}
              placeholder="Search..."
              placeholderTextColor="#888"
            />
          </View>
        </View>

        <View style={styles.headerIcons}>
          {isAuthenticated ? ( // Check if the user is authenticated
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
              <TouchableOpacity onPress={() => navigation.navigate('explore')} style={styles.iconButton}>
                <TabBarIcon name="code-slash-outline" color="#000" />
                <Text style={styles.iconButtonText}>Explore</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('profile')} style={styles.iconButton}>
                <TabBarIcon name="person-outline" color="#000" />
                <Text style={styles.iconButtonText}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('contact')} style={styles.iconButton}>
                <TabBarIcon name="call-outline" color="#000" />
                <Text style={styles.iconButtonText}>Contact Us</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('blog')} style={styles.iconButton}>
                <TabBarIcon name="document-text-outline" color="#000" />
                <Text style={styles.iconButtonText}>Blog</Text>
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
            <Tabs.Screen
              name="index"
              options={{
                title: 'Home',
                tabBarIcon: ({ color, focused }) => (
                  <TabBarIcon name={focused ? 'home' : 'home-outline'} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="explore"
              options={{
                title: 'Explore',
                tabBarIcon: ({ color, focused }) => (
                  <TabBarIcon name={focused ? 'code-slash' : 'code-slash-outline'} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="profile"
              options={{
                title: 'Profile',
                tabBarIcon: ({ color, focused }) => (
                  <TabBarIcon name={focused ? 'person' : 'person-outline'} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="contact"
              options={{
                title: 'Contact Us',
                tabBarIcon: ({ color, focused }) => (
                  <TabBarIcon name={focused ? 'call' : 'call-outline'} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="blog"
              options={{
                title: 'Blog',
                tabBarIcon: ({ color, focused }) => (
                  <TabBarIcon name={focused ? 'document-text' : 'document-text-outline'} color={color} />
                ),
              }}
            />
          </Tabs>
        </View>
      </View>
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
  },
  logo: {
    width: 100, 
    height: 180,  
    resizeMode: 'contain', 
  },
  searchContainer: {
    flex: 1,
    alignItems: 'center',
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
  toggleButtonText: {
    fontSize: 12,
    color: '#888',
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