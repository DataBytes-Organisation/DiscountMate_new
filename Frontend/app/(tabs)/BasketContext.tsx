import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type BasketRow = {
  productId: string;          // canonical _id (string)
  productCode?: string | null;
  name: string;
  price: number;
  image?: string;
  quantity: number;
};

type AddItem = {
  product_id?: string | number;     // caller can provide _id / product_id / product_code
  productId?: string | number;
  product_code?: string | number;
  productCode?: string | number;
  quantity?: number;
  name?: string;
  price?: number;
  image?: string;
};

type BasketContextType = {
  basketData: BasketRow[];
  getBasket: () => Promise<void>;
  addToBasket: (item: AddItem) => Promise<boolean>;
  removeFromBasket: (idOrCode: string) => Promise<boolean>;
  updateQuantity: (idOrCode: string, quantity: number) => Promise<boolean>;
};

const BasketContext = createContext<BasketContextType>({
  basketData: [],
  getBasket: async () => {},
  addToBasket: async () => false,
  removeFromBasket: async () => false,
  updateQuantity: async () => false,
});

const API_BASE =
  (typeof process !== 'undefined' && (process as any)?.env?.EXPO_PUBLIC_API_BASE) ||
  (typeof window !== 'undefined' && (window as any)?.location?.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'http://localhost:3000');

async function authHeaders() {
  const token = await AsyncStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function looksLikeObjectId(v: any): boolean {
  const s = String(v || '');
  return !!s && /^[0-9a-fA-F]{24}$/.test(s);
}

export const BasketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [basketData, setBasketData] = useState<BasketRow[]>([]);

  const getBasket = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/baskets/getbasket`, {
        method: 'POST',
        headers: await authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null as any);
      const items = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.items)
          ? (data as any).items
          : [];
      setBasketData(items);
    } catch (e) {
      console.error('getBasket error:', e);
    }
  };

  const addToBasket = async (item: AddItem): Promise<boolean> => {
    try {
      const quantity = Number(item.quantity ?? 1);

      const pid =
        item.product_id ?? item.productId ?? (item as any)._id ?? (item as any).id ?? null;
      const pcode = item.product_code ?? item.productCode ?? null;

      const payload: any = { quantity };

      if (pid != null) payload.product_id = String(pid);
      if (pcode != null) payload.product_code = String(pcode);

      // If only a non-ObjectId pid was provided, also send it as product_code (Coles)
      if (!payload.product_code && payload.product_id && !looksLikeObjectId(payload.product_id)) {
        payload.product_code = payload.product_id;
      }

      if (item.name) payload.name = item.name;
      if (typeof item.price !== 'undefined') payload.price = item.price;
      if (item.image) payload.image = item.image;

      const res = await fetch(`${API_BASE}/api/baskets/addtobasket`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error('addToBasket failed', res.status);
        return false;
      }

      // If server returns the new list, use it; otherwise refresh.
      const maybe = await res.json().catch(() => null as any);
      if (Array.isArray(maybe)) {
        setBasketData(maybe);
      } else if (Array.isArray((maybe as any)?.items)) {
        setBasketData((maybe as any).items);
      } else {
        await getBasket();      // ensures bubble updates immediately
      }
      return true;
    } catch (e) {
      console.error('addToBasket error:', e);
      return false;
    }
  };

  // remove with immediate context refresh
  const removeFromBasket = async (idOrCode: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/baskets/removeitem`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ product_id: idOrCode, product_code: idOrCode }),
      });
      if (!res.ok) {
        console.error('removeFromBasket failed', res.status);
        return false;
      }
      const maybe = await res.json().catch(() => null as any);
      if (Array.isArray(maybe)) {
        setBasketData(maybe);
      } else if (Array.isArray((maybe as any)?.items)) {
        setBasketData((maybe as any).items);
      } else {
        await getBasket();      // refresh so header/sidebar badges update
      }
      return true;
    } catch (e) {
      console.error('removeFromBasket error:', e);
      return false;
    }
  };

  // quantity update with immediate context refresh
  const updateQuantity = async (idOrCode: string, quantity: number): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/baskets/updatequantity`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ product_id: idOrCode, product_code: idOrCode, quantity }),
      });
      if (!res.ok) {
        console.error('updateQuantity failed', res.status);
        return false;
      }
      const maybe = await res.json().catch(() => null as any);
      if (Array.isArray(maybe)) {
        setBasketData(maybe);
      } else if (Array.isArray((maybe as any)?.items)) {
        setBasketData((maybe as any).items);
      } else {
        await getBasket();      // refresh
      }
      return true;
    } catch (e) {
      console.error('updateQuantity error:', e);
      return false;
    }
  };

  useEffect(() => { getBasket(); }, []);

  return (
    <BasketContext.Provider
      value={{ basketData, getBasket, addToBasket, removeFromBasket, updateQuantity }}
    >
      {children}
    </BasketContext.Provider>
  );
};

export const useBasket = () => useContext(BasketContext);
