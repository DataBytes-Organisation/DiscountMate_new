import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'react-native-toast-notifications';
import { API_URL } from '@/constants/Api';

const BasketContext = createContext(null);

export const useBasket = () => useContext(BasketContext);

export const BasketProvider = ({ children }) => {
  const [basketData, setBasketData] = useState([]);
  const toast = useToast();

  const getBasket = async () => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/baskets/getbasket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setBasketData(data);
    } catch (error) {
      console.error(error.message);
    }
  };

  const addToBasket = async (item) => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      toast.show('Please log in to add items to basket.', { type: 'warning', placement: 'top' });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/baskets/addtobasket`, {
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
      setBasketData(data);
      toast.show('Item added to basket!', { type: 'success', placement: 'top' });
    } catch (error) {
      console.error(error.message);
      toast.show(`Failed to add item: ${error.message}`, { type: 'danger', placement: 'top' });
    }
  };

  useEffect(() => {
    getBasket();
  }, []);

  return (
    <BasketContext.Provider value={{ basketData, addToBasket, getBasket }}>
      {children}
    </BasketContext.Provider>
  );
};