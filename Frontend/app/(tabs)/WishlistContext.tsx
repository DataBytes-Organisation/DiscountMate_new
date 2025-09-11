import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'react-native-toast-notifications';
import { API_URL } from '@/constants/Api';

const WishlistContext = createContext(null);

export const useWishlist = () => useContext(WishlistContext);

export const WishlistProvider = ({ children }) => {
  const [wishlist, setWishlist] = useState([]);
  const toast = useToast();

  const getWishlist = async () => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/wishlist/getwishlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setWishlist(data);
    } catch (error) {
      console.error(error.message);
    }
  };

  const addToWishlist = async (item) => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      toast.show('Please log in to add items to your wishlist.', { type: 'warning', placement: 'top' });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/wishlist/addtowishlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ productId: item.product_id }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setWishlist(data);
      toast.show('Item added to wishlist!', { type: 'success', placement: 'top' });
    } catch (error) {
      console.error(error.message);
      toast.show(`Failed to add item to wishlist: ${error.message}`, { type: 'danger', placement: 'top' });
    }
  };

  useEffect(() => {
    getWishlist();
  }, []);

  return (
    <WishlistContext.Provider value={{ wishlist, addToWishlist, getWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};