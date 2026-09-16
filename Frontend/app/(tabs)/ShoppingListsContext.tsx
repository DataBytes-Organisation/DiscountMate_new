import React, {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useMemo,
   useState,
   type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../../constants/Api";
import type { ShoppingList, ShoppingListAccent, ShoppingListLineItem } from "../../types/ShoppingList";

type ApiListResponse = {
   lists: ShoppingList[];
   activeListId: string | null;
};

type ApiSingleListResponse = {
   list: ShoppingList;
   activeListId?: string | null;
};

function normalizeList(raw: ShoppingList): ShoppingList {
   const items = Array.isArray(raw.items) ? raw.items : [];
   return {
      ...raw,
      description: raw.description ?? "",
      accent: raw.accent ?? "emerald",
      createdLabel: raw.createdLabel ?? "Just now",
      updatedLabel: raw.updatedLabel ?? "Just now",
      items,
      total: typeof raw.total === "number" ? raw.total : computeListTotal(items),
      savings: typeof raw.savings === "number" ? raw.savings : 0,
   };
}

function randomId() {
   return `list_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function isMongoId(id: string) {
   return /^[a-f\d]{24}$/i.test(id);
}

async function getAuthToken() {
   return AsyncStorage.getItem("authToken");
}

async function apiRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
   const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${token}`,
         ...(init.headers ?? {}),
      },
   });

   const data = await response.json().catch(() => ({}));
   if (!response.ok) {
      throw new Error(data?.message || `Request failed with status ${response.status}`);
   }

   return data as T;
}

type CreateListInput = {
   name: string;
   description: string;
   accent: ShoppingListAccent;
};

type ActiveListItemInput = {
   id: string;
   name: string;
   price: number;
   quantity?: number;
   store?: string;
   image?: string;
   category?: string;
   categoryId?: string;
   comparisonProductId?: string;
   sourceProductId?: string;
   deProductId?: string;
   gtin?: string;
   brand?: string;
   packQuantity?: string;
   packUom?: string;
   retailerPrices?: {
      coles?: number;
      woolworths?: number;
      iga?: number;
   };
};

type RetailerKey = "coles" | "woolworths" | "iga";

function computeListTotal(items: ShoppingListLineItem[]) {
   return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function toLineItem(item: ActiveListItemInput): ShoppingListLineItem {
   return {
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: Math.max(1, item.quantity ?? 1),
      store: item.store,
      image: item.image,
      category: item.category,
      categoryId: item.categoryId,
      comparisonProductId: item.comparisonProductId,
      sourceProductId: item.sourceProductId,
      deProductId: item.deProductId,
      gtin: item.gtin,
      brand: item.brand,
      packQuantity: item.packQuantity,
      packUom: item.packUom,
      retailerPrices: item.retailerPrices,
   };
}

type ShoppingListsContextValue = {
   lists: ShoppingList[];
   activeListId: string | null;
   isLoading: boolean;
   isAuthenticated: boolean | null;
   refreshLists: () => Promise<void>;
   setActiveList: (id: string) => void;
   createList: (input: CreateListInput) => Promise<ShoppingList>;
   updateList: (id: string, input: Partial<CreateListInput>) => void;
   deleteList: (id: string) => void;
   getActiveList: () => ShoppingList | null;
   getListById: (id: string) => ShoppingList | undefined;
   addItemToActiveList: (item: ActiveListItemInput) => Promise<{ action: "added" | "updated" }>;
   removeItemFromActiveList: (itemId: string) => void;
   updateActiveListItemQuantity: (itemId: string, quantity: number) => void;
   clearActiveListItems: () => void;
   replaceActiveListItems: (items: ActiveListItemInput[]) => void;
   removeItemFromList: (listId: string, itemId: string) => void;
   updateListItemQuantity: (listId: string, itemId: string, quantity: number) => Promise<void>;
   updateListItemRetailer: (
      listId: string,
      itemId: string,
      retailer: RetailerKey
   ) => void;
   updateListItemsRetailers: (listId: string, retailersByItemId: Record<string, RetailerKey>) => void;
};

const ShoppingListsContext = createContext<ShoppingListsContextValue | undefined>(undefined);

export function ShoppingListsProvider({ children }: { children: ReactNode }) {
   const [lists, setLists] = useState<ShoppingList[]>([]);
   const [activeListId, setActiveListIdState] = useState<string | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

   const refreshLists = useCallback(async () => {
      setIsLoading(true);
      let hasToken = false;
      try {
         const token = await getAuthToken();
         hasToken = Boolean(token);
         setIsAuthenticated(hasToken);
         if (!token) {
            setLists([]);
            setActiveListIdState(null);
            return;
         }

         const data = await apiRequest<ApiListResponse>("/shopping-lists", token);
         const hydratedLists = data.lists.map(normalizeList);
         setLists(hydratedLists);
         setActiveListIdState(data.activeListId ?? hydratedLists[0]?.id ?? null);
      } catch (error) {
         console.error("Failed to load shopping lists:", error);
         setLists([]);
         setActiveListIdState(null);
         setIsAuthenticated(hasToken);
      } finally {
         setIsLoading(false);
      }
   }, []);

   useEffect(() => {
      refreshLists();
   }, [refreshLists]);

   const persistList = useCallback(async (list: ShoppingList) => {
      if (!isMongoId(list.id)) return;

      const token = await getAuthToken();
      if (!token) throw new Error("Please log in to update this list.");

      await apiRequest<ApiSingleListResponse>(`/shopping-lists/${list.id}`, token, {
         method: "PUT",
         body: JSON.stringify({
            name: list.name,
            description: list.description,
            accent: list.accent,
            items: list.items,
            total: list.total,
            savings: list.savings,
         }),
      });
   }, []);

   const setActiveList = useCallback((id: string) => {
      setActiveListIdState(id);

      if (!isMongoId(id)) return;
      (async () => {
         try {
            const token = await getAuthToken();
            if (!token) return;
            await apiRequest<{ activeListId: string }>(`/shopping-lists/${id}/active`, token, {
               method: "PUT",
            });
         } catch (error) {
            console.error("Failed to set active shopping list:", error);
         }
      })();
   }, []);

   const createList = useCallback(
      async (input: CreateListInput): Promise<ShoppingList> => {
         const token = await getAuthToken();
         if (!token) {
            throw new Error("Please log in to create shopping lists.");
         }

         const optimisticList: ShoppingList = {
            id: randomId(),
            name: input.name.trim() || "Untitled list",
            description: input.description.trim(),
            accent: input.accent,
            createdLabel: "Just now",
            updatedLabel: "Just now",
            total: 0,
            savings: 0,
            items: [],
         };

         const shouldSetActive = !activeListId;
         setLists((prev) => [...prev, optimisticList]);
         if (shouldSetActive) setActiveListIdState(optimisticList.id);

         try {
            const data = await apiRequest<ApiSingleListResponse>("/shopping-lists", token, {
               method: "POST",
               body: JSON.stringify({
                  name: optimisticList.name,
                  description: optimisticList.description,
                  accent: optimisticList.accent,
                  isActive: shouldSetActive,
               }),
            });

            const persistedList = normalizeList(data.list);
            setLists((prev) =>
               prev.map((list) => (list.id === optimisticList.id ? persistedList : list))
            );
            if (shouldSetActive || data.activeListId === persistedList.id) {
               setActiveListIdState(persistedList.id);
            }

            return persistedList;
         } catch (error) {
            console.error("Failed to create shopping list:", error);
            setLists((prev) => prev.filter((list) => list.id !== optimisticList.id));
            if (shouldSetActive) setActiveListIdState(null);
            throw error;
         }
      },
      [activeListId]
   );

   const updateList = useCallback(
      (id: string, input: Partial<CreateListInput>) => {
         const target = lists.find((list) => list.id === id);
         if (!target) return;

         const updatedList: ShoppingList = {
            ...target,
            ...("name" in input && input.name !== undefined
               ? { name: input.name.trim() || target.name }
               : {}),
            ...("description" in input && input.description !== undefined
               ? { description: input.description.trim() }
               : {}),
            ...("accent" in input && input.accent !== undefined ? { accent: input.accent } : {}),
            updatedLabel: "Just now",
         };

         setLists((prev) => prev.map((list) => (list.id === id ? updatedList : list)));
         void persistList(updatedList).catch((error) => console.error("Failed to save shopping list:", error));
      },
      [lists, persistList]
   );

   const deleteList = useCallback(
      (id: string) => {
         const deletedIndex = lists.findIndex((list) => list.id === id);
         const next = lists.filter((list) => list.id !== id);
         const fallbackActiveId =
            deletedIndex >= 0
               ? next[Math.min(deletedIndex, next.length - 1)]?.id ?? null
               : next[0]?.id ?? null;

         setLists(next);
         setActiveListIdState((current) => (current === id ? fallbackActiveId : current));

         if (!isMongoId(id)) return;
         (async () => {
            try {
               const token = await getAuthToken();
               if (!token) return;
               const data = await apiRequest<{ activeListId: string | null }>(
                  `/shopping-lists/${id}`,
                  token,
                  { method: "DELETE" }
               );
               if (activeListId === id) {
                  setActiveListIdState(data.activeListId ?? fallbackActiveId);
               }
            } catch (error) {
               console.error("Failed to delete shopping list:", error);
            }
         })();
      },
      [activeListId, lists]
   );

   const commitListChange = useCallback(
      (listId: string, update: (list: ShoppingList) => ShoppingList) => {
         setLists((prev) => {
            const target = prev.find((list) => list.id === listId);
            if (!target) return prev;

            const updatedList = update(target);
            void persistList(updatedList).catch((error) => console.error("Failed to save shopping list:", error));
            return prev.map((list) => (list.id === listId ? updatedList : list));
         });
      },
      [persistList]
   );

   const updateListItemQuantity = useCallback(
      async (listId: string, itemId: string, quantity: number) => {
         const original = lists.find((list) => list.id === listId);
         if (!original) return;
         const nextItems =
            quantity <= 0
               ? original.items.filter((item) => item.id !== itemId)
               : original.items.map((item) => (item.id === itemId ? { ...item, quantity } : item));
         const updatedList = {
            ...original,
            items: nextItems,
            total: computeListTotal(nextItems),
            updatedLabel: "Just now",
         };
         setLists((prev) => prev.map((list) => (list.id === listId ? updatedList : list)));

         if (!isMongoId(listId)) return;
         try {
            const token = await getAuthToken();
            if (!token) throw new Error("Please log in to update this list.");
            await apiRequest<ApiSingleListResponse>(`/shopping-lists/${listId}`, token, {
               method: "PUT",
               body: JSON.stringify({
                  name: updatedList.name,
                  description: updatedList.description,
                  accent: updatedList.accent,
                  items: updatedList.items,
                  total: updatedList.total,
                  savings: updatedList.savings,
               }),
            });
         } catch (error) {
            setLists((prev) => prev.map((list) => (list.id === listId ? original : list)));
            throw error;
         }
      },
      [lists]
   );

   const removeItemFromList = useCallback(
      (listId: string, itemId: string) => {
         commitListChange(listId, (list) => {
            const nextItems = list.items.filter((item) => item.id !== itemId);
            return {
               ...list,
               items: nextItems,
               total: computeListTotal(nextItems),
               updatedLabel: "Just now",
            };
         });
      },
      [commitListChange]
   );

   const updateListItemRetailer = useCallback(
      (listId: string, itemId: string, retailer: RetailerKey) => {
         commitListChange(listId, (list) => {
            const nextItems = list.items.map((item) => {
               if (item.id !== itemId) return item;

               const selectedPrice = item.retailerPrices?.[retailer];
               if (typeof selectedPrice !== "number" || selectedPrice <= 0) {
                  return item;
               }

               const storeName =
                  retailer === "iga" ? "IGA" : retailer === "coles" ? "Coles" : "Woolworths";

               return {
                  ...item,
                  store: storeName,
                  price: selectedPrice,
               };
            });

            return {
               ...list,
               items: nextItems,
               total: computeListTotal(nextItems),
               updatedLabel: "Just now",
            };
         });
      },
      [commitListChange]
   );

   const updateListItemsRetailers = useCallback(
      (listId: string, retailersByItemId: Record<string, RetailerKey>) => {
         commitListChange(listId, (list) => {
            const nextItems = list.items.map((item) => {
               const retailer = retailersByItemId[item.id];
               if (!retailer) return item;

               const selectedPrice = item.retailerPrices?.[retailer];
               if (typeof selectedPrice !== "number" || selectedPrice <= 0) {
                  return item;
               }

               const storeName =
                  retailer === "iga" ? "IGA" : retailer === "coles" ? "Coles" : "Woolworths";

               return {
                  ...item,
                  store: storeName,
                  price: selectedPrice,
               };
            });

            return {
               ...list,
               items: nextItems,
               total: computeListTotal(nextItems),
               updatedLabel: "Just now",
            };
         });
      },
      [commitListChange]
   );

   const addItemToActiveList = useCallback(
      async (item: ActiveListItemInput) => {
         if (!activeListId) throw new Error("Please select a grocery list first.");
         const original = lists.find((list) => list.id === activeListId);
         if (!original) throw new Error("The active grocery list could not be found.");
         const existingIndex = original.items.findIndex((existing) => (
            (existing.comparisonProductId || existing.deProductId || existing.id) ===
            (item.comparisonProductId || item.deProductId || item.id)
         ));
         const action: "added" | "updated" = existingIndex >= 0 ? "updated" : "added";
         const updatedList = (() => {
            const list = original;
            const qtyToAdd = Math.max(1, item.quantity ?? 1);
            let nextItems: ShoppingListLineItem[];

            if (existingIndex >= 0) {
               nextItems = [...list.items];
               const existing = nextItems[existingIndex];
               nextItems[existingIndex] = {
                  ...existing,
                  quantity: existing.quantity + qtyToAdd,
                  price: item.price,
                  store: item.store ?? existing.store,
                  image: item.image ?? existing.image,
                  category: item.category ?? existing.category,
                  categoryId: item.categoryId ?? existing.categoryId,
                  comparisonProductId: item.comparisonProductId ?? existing.comparisonProductId,
                  sourceProductId: item.sourceProductId ?? existing.sourceProductId,
                  deProductId: item.deProductId ?? existing.deProductId,
                  gtin: item.gtin ?? existing.gtin,
                  brand: item.brand ?? existing.brand,
                  packQuantity: item.packQuantity ?? existing.packQuantity,
                  packUom: item.packUom ?? existing.packUom,
                  retailerPrices: item.retailerPrices ?? existing.retailerPrices,
               };
            } else {
               nextItems = [...list.items, toLineItem({ ...item, quantity: qtyToAdd })];
            }

            return {
               ...list,
               items: nextItems,
               total: computeListTotal(nextItems),
               updatedLabel: "Just now",
            };
         })();
         setLists((prev) => prev.map((list) => (list.id === activeListId ? updatedList : list)));
         try {
            await persistList(updatedList);
            return { action };
         } catch (error) {
            setLists((prev) => prev.map((list) => (list.id === activeListId ? original : list)));
            throw error;
         }
      },
      [activeListId, lists, persistList]
   );

   const removeItemFromActiveList = useCallback(
      (itemId: string) => {
         if (!activeListId) return;
         removeItemFromList(activeListId, itemId);
      },
      [activeListId, removeItemFromList]
   );

   const updateActiveListItemQuantity = useCallback(
      (itemId: string, quantity: number) => {
         if (!activeListId) return;
         void updateListItemQuantity(activeListId, itemId, quantity).catch((error) => {
            console.error("Failed to update active-list quantity:", error);
         });
      },
      [activeListId, updateListItemQuantity]
   );

   const clearActiveListItems = useCallback(() => {
      if (!activeListId) return;

      commitListChange(activeListId, (list) => ({
         ...list,
         items: [],
         total: 0,
         updatedLabel: "Just now",
      }));
   }, [activeListId, commitListChange]);

   const replaceActiveListItems = useCallback(
      (items: ActiveListItemInput[]) => {
         if (!activeListId) return;

         commitListChange(activeListId, (list) => {
            const nextItems = items.map(toLineItem);
            return {
               ...list,
               items: nextItems,
               total: computeListTotal(nextItems),
               updatedLabel: "Just now",
            };
         });
      },
      [activeListId, commitListChange]
   );

   const getActiveList = useCallback((): ShoppingList | null => {
      if (!activeListId) return null;
      return lists.find((list) => list.id === activeListId) ?? null;
   }, [lists, activeListId]);

   const getListById = useCallback(
      (id: string) => lists.find((list) => list.id === id),
      [lists]
   );

   const value = useMemo(
      () => ({
         lists,
         activeListId,
         isLoading,
         isAuthenticated,
         refreshLists,
         setActiveList,
         createList,
         updateList,
         deleteList,
         getActiveList,
         getListById,
         addItemToActiveList,
         removeItemFromActiveList,
         updateActiveListItemQuantity,
         clearActiveListItems,
         replaceActiveListItems,
         removeItemFromList,
         updateListItemQuantity,
         updateListItemRetailer,
         updateListItemsRetailers,
      }),
      [
         lists,
         activeListId,
         isLoading,
         isAuthenticated,
         refreshLists,
         setActiveList,
         createList,
         updateList,
         deleteList,
         getActiveList,
         getListById,
         addItemToActiveList,
         removeItemFromActiveList,
         updateActiveListItemQuantity,
         clearActiveListItems,
         replaceActiveListItems,
         removeItemFromList,
         updateListItemQuantity,
         updateListItemRetailer,
         updateListItemsRetailers,
      ]
   );

   return (
      <ShoppingListsContext.Provider value={value}>{children}</ShoppingListsContext.Provider>
   );
}

export function useShoppingLists() {
   const ctx = useContext(ShoppingListsContext);
   if (!ctx) {
      throw new Error("useShoppingLists must be used within ShoppingListsProvider");
   }
   return ctx;
}
