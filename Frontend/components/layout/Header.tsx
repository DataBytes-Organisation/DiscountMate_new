import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Link, router } from 'expo-router';
import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useAuth } from '@/app/(tabs)/AuthContext';
import BrowseProductsDropdown from '@/app/(tabs)/BrowseProductsDropdown';
import CartBadge from '@/components/CartBadge';

type HeaderProps = {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  unreadCount: number;
  toggleNotifications: () => void;
};

export default function Header({
  searchQuery,
  setSearchQuery,
  unreadCount,
  toggleNotifications,
}: HeaderProps) {
  const { isAuthenticated, logout } = useAuth();

  const handleSearch = () => {
    if (searchQuery.trim() !== '') {
      router.push(`/search?query=${searchQuery}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      router.push('/login');
    } catch {
      // no-op
    }
  };

  return (
    <View style={styles.headerContainer}>
      {/* Left: single wordmark + browse */}
      <View style={styles.leftGroup}>
        <TouchableOpacity onPress={() => router.push('/')} style={styles.brandWrap}>
          {/* Removed the logo image to avoid the tiny duplicate wordmark */}
          <Text style={styles.brand}>DiscountMate</Text>
        </TouchableOpacity>

        {/* Keep dropdown stacking fix */}
        <View style={styles.dropdownWrap}>
          <BrowseProductsDropdown />
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Icon name="search" size={18} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
      </View>

      {/* Right side */}
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

        <CartBadge to="/basketsummary" variant="header" />

        <TouchableOpacity onPress={() => router.push('/profile')} style={styles.iconButton}>
          <TabBarIcon name="person-outline" color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
    zIndex: 1000,
    overflow: 'visible',
  },
  leftGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandWrap: { flexDirection: 'row', alignItems: 'center' },

  // Single, larger wordmark
  brand: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111',
    letterSpacing: 0.2,
  },

  // Ensure dropdown overlays correctly
  dropdownWrap: { position: 'relative', zIndex: 2000 },

  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, color: '#111' },

  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loginSignupButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#6595a3',
  },
  loginSignupText: { color: '#fff', fontWeight: '600' },
  signOutButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#6595a3',
  },
  signOutText: { color: '#fff', fontWeight: '600' },

  iconButton: { paddingHorizontal: 6, paddingVertical: 4 },

  badgeContainer: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: 'red',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
});
