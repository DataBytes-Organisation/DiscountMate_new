import React, { createContext, useContext, type ReactNode, useMemo } from "react";
import { useShoppingLists } from "./ShoppingListsContext";

type CartItem = {
   id: string;
   name: string;
   price: number;
   store?: string;
   quantity?: number;
   image?: string;
   category?: string;
   categoryId?: string;
   retailerPrices?: {
      coles?: number;
      woolworths?: number;
      iga?: number;
   };
};

type CartContextType = {
   cartItems: CartItem[];
   addToCart: (item: CartItem) => void;
   removeFromCart: (itemId: string) => void;
   updateQuantity: (itemId: string, quantity: number) => void;
   clearCart: () => void;
   replaceCart: (items: CartItem[]) => void;
   getTotalItems: () => number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
   const {
      getActiveList,
      addItemToActiveList,
      removeItemFromActiveList,
      updateActiveListItemQuantity,
      clearActiveListItems,
      replaceActiveListItems,
   } = useShoppingLists();

   const activeList = getActiveList();
   const cartItems: CartItem[] = useMemo(
      () =>
         (activeList?.items ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            store: item.store,
            quantity: item.quantity,
            image: item.image,
            category: item.category,
            categoryId: item.categoryId,
            retailerPrices: item.retailerPrices,
         })),
      [activeList]
   );

   const addToCart = (item: CartItem) => {
      addItemToActiveList(item);
   };

   const removeFromCart = (itemId: string) => {
      removeItemFromActiveList(itemId);
   };

   const updateQuantity = (itemId: string, quantity: number) => {
      updateActiveListItemQuantity(itemId, quantity);
   };

   const clearCart = () => {
      clearActiveListItems();
   };

   const replaceCart = (items: CartItem[]) => {
      replaceActiveListItems(items);
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
            replaceCart,
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
      throw new Error("useCart must be used within a CartProvider");
   }
   return context;
};
