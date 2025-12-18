import React, { createContext, useState, useContext, ReactNode } from 'react';

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

export const CartProvider = ({ children }: { children: ReactNode }) => {
   const [cartItems, setCartItems] = useState<CartItem[]>([]);

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
   };

   const removeFromCart = (itemId: string) => {
      setCartItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
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
   };

   const clearCart = () => {
      setCartItems([]);
   };

   const getTotalItems = () => {
      return cartItems.reduce((total, item) => total + (item.quantity || 1), 0);
   };

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
