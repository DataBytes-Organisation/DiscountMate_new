import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useEffect, useState, useContext, ReactNode } from 'react';
import { API_URL } from '../../constants/Api';

type CartItem = {
   id: string;
   name: string;
   price: number;
   store?: string;
   quantity?: number;
};

type CartContextType = {
   cartItems: CartItem[];
   addToCart: (item: CartItem) => void;
   removeFromCart: (itemId: string) => void;
   updateQuantity: (itemId: string, quantity: number) => void;
   clearCart: () => void;
   getTotalItems: () => number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

async function getAuthHeaders() {
   const token = await AsyncStorage.getItem('authToken');
   if (!token) {
      return null;
   }

   return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
   };
}

function mapBasketItem(item: any): CartItem | null {
   const id = String(item?.productId || item?.product_id || item?.id || '').trim();
   if (!id) {
      return null;
   }

   return {
      id,
      name: String(item?.name || item?.product_name || 'DiscountMate product'),
      price: Number(item?.price || item?.current_price || 0),
      store: item?.store || item?.store_chain || 'Coles',
      quantity: Math.max(1, Number(item?.quantity || 1)),
   };
}

export const CartProvider = ({ children }: { children: ReactNode }) => {
   const [cartItems, setCartItems] = useState<CartItem[]>([]);

   const refreshCartFromBackend = async () => {
      const headers = await getAuthHeaders();
      if (!headers) {
         return;
      }

      try {
         const response = await fetch(`${API_URL}/baskets/getbasket`, {
            method: 'POST',
            headers,
         });
         const data = await response.json();
         if (!response.ok || !Array.isArray(data)) {
            return;
         }

         setCartItems(data.map(mapBasketItem).filter(Boolean) as CartItem[]);
      } catch (error) {
         console.error('Unable to sync cart from backend:', error);
      }
   };

   const addToCart = (item: CartItem) => {
      setCartItems((prevItems) => {
         // Check if item already exists in cart
         const existingItemIndex = prevItems.findIndex((cartItem) => cartItem.id === item.id);
         if (existingItemIndex !== -1) {
            // If item exists, increment its quantity
            const updatedItems = [...prevItems];
            const existingItem = updatedItems[existingItemIndex];
            updatedItems[existingItemIndex] = {
               ...existingItem,
               quantity: (existingItem.quantity || 1) + 1,
            };
            return updatedItems;
         }
         // Add new item to cart with quantity 1
         return [...prevItems, { ...item, quantity: 1 }];
      });

      void (async () => {
         const headers = await getAuthHeaders();
         if (!headers) {
            return;
         }

         try {
            await fetch(`${API_URL}/baskets/addtobasket`, {
               method: 'POST',
               headers,
               body: JSON.stringify({
                  productId: item.id,
                  quantity: 1,
               }),
            });
         } catch (error) {
            console.error('Unable to sync added cart item:', error);
         }
      })();
   };

   const removeFromCart = (itemId: string) => {
      setCartItems((prevItems) => prevItems.filter((item) => item.id !== itemId));

      void (async () => {
         const headers = await getAuthHeaders();
         if (!headers) {
            return;
         }

         try {
            await fetch(`${API_URL}/baskets/deleteitemfrombasket`, {
               method: 'DELETE',
               headers,
               body: JSON.stringify({ productId: itemId }),
            });
         } catch (error) {
            console.error('Unable to sync removed cart item:', error);
         }
      })();
   };

   const updateQuantity = (itemId: string, quantity: number) => {
      if (quantity <= 0) {
         removeFromCart(itemId);
         return;
      }
      setCartItems((prevItems) =>
         prevItems.map((item) =>
            item.id === itemId ? { ...item, quantity } : item
         )
      );

      void (async () => {
         const headers = await getAuthHeaders();
         if (!headers) {
            return;
         }

         try {
            await fetch(`${API_URL}/baskets/updatequantity`, {
               method: 'POST',
               headers,
               body: JSON.stringify({ productId: itemId, quantity }),
            });
         } catch (error) {
            console.error('Unable to sync cart quantity:', error);
         }
      })();
   };

   const clearCart = () => {
      setCartItems([]);
   };

   const getTotalItems = () => {
      return cartItems.reduce((total, item) => total + (item.quantity || 1), 0);
   };

   useEffect(() => {
      void refreshCartFromBackend();
   }, []);

   return (
      <CartContext.Provider
         value={{
            cartItems,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            getTotalItems,
         }}
      >
         {children}
      </CartContext.Provider>
   );
};

export const useCart = () => {
   const context = useContext(CartContext);
   if (context === undefined) {
      throw new Error('useCart must be used within a CartProvider');
   }
   return context;
};
