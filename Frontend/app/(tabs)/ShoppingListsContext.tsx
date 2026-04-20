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
import type { ShoppingList, ShoppingListAccent, ShoppingListLineItem } from "../../types/ShoppingList";

const STORAGE_KEY = "@discountmate_shopping_lists_v1";

type PersistedShape = {
   lists: ShoppingList[];
   activeListId: string | null;
};

function normalizeList(raw: ShoppingList): ShoppingList {
   return {
      ...raw,
      description: raw.description ?? "",
      createdLabel: raw.createdLabel ?? raw.updatedLabel ?? "Just now",
      updatedLabel: raw.updatedLabel ?? "Just now",
      items: Array.isArray(raw.items) ? raw.items : [],
      total: typeof raw.total === "number" ? raw.total : 0,
      savings: typeof raw.savings === "number" ? raw.savings : 0,
   };
}

function seedLists(): ShoppingList[] {
   return [
      {
         id: "list_seed_weekly",
         name: "Weekly Essentials",
         description: "Regular top-up shop",
         accent: "emerald",
         createdLabel: "3 weeks ago",
         updatedLabel: "2 days ago",
         total: 90.0,
         savings: 8.9,
         items: [
            { id: "i1", name: "Milk 2L", price: 3.5, quantity: 1 },
            { id: "i2", name: "Wholemeal bread", price: 4.2, quantity: 2 },
            { id: "i3", name: "Bananas", price: 3.9, quantity: 1 },
            { id: "i4", name: "Chicken breast", price: 12.0, quantity: 1 },
            { id: "i5", name: "Greek yoghurt", price: 6.5, quantity: 2 },
         ],
      },
      {
         id: "list_seed_monthly",
         name: "Monthly Stock-up",
         description: "Pantry and household refill",
         accent: "amber",
         createdLabel: "1 month ago",
         updatedLabel: "1 week ago",
         total: 150.0,
         savings: 17.2,
         items: [
            { id: "i6", name: "Olive oil 750ml", price: 14.0, quantity: 1 },
            { id: "i7", name: "Laundry liquid", price: 18.0, quantity: 1 },
            { id: "i8", name: "Pasta 500g", price: 2.2, quantity: 4 },
         ],
      },
      {
         id: "list_seed_snacks",
         name: "Healthy Snacks",
         description: "Workweek grab-and-go",
         accent: "sky",
         createdLabel: "2 weeks ago",
         updatedLabel: "2 days ago",
         total: 50.0,
         savings: 6.9,
         items: [
            { id: "i9", name: "Mixed nuts", price: 8.5, quantity: 1 },
            { id: "i10", name: "Protein bars", price: 4.5, quantity: 6 },
         ],
      },
   ];
}

function randomId() {
   return `list_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
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
   retailerPrices?: {
      coles?: number;
      woolworths?: number;
      iga?: number;
   };
};

function computeListTotal(items: ShoppingListLineItem[]) {
   return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

type ShoppingListsContextValue = {
   lists: ShoppingList[];
   activeListId: string | null;
   setActiveList: (id: string) => void;
   createList: (input: CreateListInput) => ShoppingList;
   updateList: (id: string, input: Partial<CreateListInput>) => void;
   deleteList: (id: string) => void;
   getActiveList: () => ShoppingList | null;
   getListById: (id: string) => ShoppingList | undefined;
   addItemToActiveList: (item: ActiveListItemInput) => void;
   removeItemFromActiveList: (itemId: string) => void;
   updateActiveListItemQuantity: (itemId: string, quantity: number) => void;
   clearActiveListItems: () => void;
   replaceActiveListItems: (items: ActiveListItemInput[]) => void;
   removeItemFromList: (listId: string, itemId: string) => void;
   updateListItemQuantity: (listId: string, itemId: string, quantity: number) => void;
   updateListItemRetailer: (
      listId: string,
      itemId: string,
      retailer: "coles" | "woolworths" | "iga"
   ) => void;
};

const ShoppingListsContext = createContext<ShoppingListsContextValue | undefined>(undefined);

export function ShoppingListsProvider({ children }: { children: ReactNode }) {
   const [lists, setLists] = useState<ShoppingList[]>([]);
   const [activeListId, setActiveListIdState] = useState<string | null>(null);
   const [hydrated, setHydrated] = useState(false);

   useEffect(() => {
      let cancelled = false;
      (async () => {
         try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (cancelled) return;
            if (raw) {
               const parsed = JSON.parse(raw) as PersistedShape;
               if (Array.isArray(parsed.lists) && parsed.lists.length > 0) {
                  const hydratedLists = parsed.lists.map(normalizeList);
                  setLists(hydratedLists);
                  setActiveListIdState(parsed.activeListId ?? hydratedLists[0].id);
               } else {
                  const seed = seedLists();
                  setLists(seed);
                  setActiveListIdState(seed[0].id);
               }
            } else {
               const seed = seedLists();
               setLists(seed);
               setActiveListIdState(seed[0].id);
            }
         } catch {
            const seed = seedLists();
            setLists(seed);
            setActiveListIdState(seed[0].id);
         } finally {
            if (!cancelled) setHydrated(true);
         }
      })();
      return () => {
         cancelled = true;
      };
   }, []);

   useEffect(() => {
      if (!hydrated) return;
      const payload: PersistedShape = { lists, activeListId };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
   }, [lists, activeListId, hydrated]);

   const setActiveList = useCallback((id: string) => {
      setActiveListIdState(id);
   }, []);

   const createList = useCallback((input: CreateListInput): ShoppingList => {
      const list: ShoppingList = {
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
      setLists((prev) => [...prev, list]);
      setActiveListIdState((current) => current ?? list.id);
      return list;
   }, []);

   const updateList = useCallback((id: string, input: Partial<CreateListInput>) => {
      setLists((prev) =>
         prev.map((l) => {
            if (l.id !== id) return l;
            return {
               ...l,
               ...("name" in input && input.name !== undefined
                  ? { name: input.name.trim() || l.name }
                  : {}),
               ...("description" in input && input.description !== undefined
                  ? { description: input.description.trim() }
                  : {}),
               ...("accent" in input && input.accent !== undefined ? { accent: input.accent } : {}),
               updatedLabel: "Just now",
            };
         })
      );
   }, []);

   const deleteList = useCallback((id: string) => {
      setLists((prev) => {
         const deletedIndex = prev.findIndex((l) => l.id === id);
         const next = prev.filter((l) => l.id !== id);

         const fallbackActiveId =
            deletedIndex >= 0
               ? next[Math.min(deletedIndex, next.length - 1)]?.id ?? null
               : next[0]?.id ?? null;

         setActiveListIdState((current) =>
            current === id ? fallbackActiveId : current
         );
         return next;
      });
   }, []);

   const updateListItemQuantity = useCallback((listId: string, itemId: string, quantity: number) => {
      if (quantity <= 0) {
         setLists((prev) =>
            prev.map((list) => {
               if (list.id !== listId) return list;
               const nextItems = list.items.filter((item) => item.id !== itemId);
               return {
                  ...list,
                  items: nextItems,
                  total: computeListTotal(nextItems),
                  updatedLabel: "Just now",
               };
            })
         );
         return;
      }

      setLists((prev) =>
         prev.map((list) => {
            if (list.id !== listId) return list;
            const nextItems = list.items.map((item) =>
               item.id === itemId ? { ...item, quantity } : item
            );
            return {
               ...list,
               items: nextItems,
               total: computeListTotal(nextItems),
               updatedLabel: "Just now",
            };
         })
      );
   }, []);

   const removeItemFromList = useCallback((listId: string, itemId: string) => {
      setLists((prev) =>
         prev.map((list) => {
            if (list.id !== listId) return list;
            const nextItems = list.items.filter((item) => item.id !== itemId);
            return {
               ...list,
               items: nextItems,
               total: computeListTotal(nextItems),
               updatedLabel: "Just now",
            };
         })
      );
   }, []);

   const updateListItemRetailer = useCallback(
      (listId: string, itemId: string, retailer: "coles" | "woolworths" | "iga") => {
         setLists((prev) =>
            prev.map((list) => {
               if (list.id !== listId) return list;

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
            })
         );
      },
      []
   );

   const addItemToActiveList = useCallback((item: ActiveListItemInput) => {
      setLists((prev) =>
         prev.map((list) => {
            if (list.id !== activeListId) return list;

            const qtyToAdd = Math.max(1, item.quantity ?? 1);
            const existingIndex = list.items.findIndex((existing) => existing.id === item.id);
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
                  retailerPrices: item.retailerPrices ?? existing.retailerPrices,
               };
            } else {
               nextItems = [
                  ...list.items,
                  {
                     id: item.id,
                     name: item.name,
                     price: item.price,
                     quantity: qtyToAdd,
                     store: item.store,
                     image: item.image,
                     retailerPrices: item.retailerPrices,
                  },
               ];
            }

            return {
               ...list,
               items: nextItems,
               total: computeListTotal(nextItems),
               updatedLabel: "Just now",
            };
         })
      );
   }, [activeListId]);

   const removeItemFromActiveList = useCallback((itemId: string) => {
      if (!activeListId) return;
      removeItemFromList(activeListId, itemId);
   }, [activeListId, removeItemFromList]);

   const updateActiveListItemQuantity = useCallback((itemId: string, quantity: number) => {
      if (!activeListId) return;
      updateListItemQuantity(activeListId, itemId, quantity);
   }, [activeListId, updateListItemQuantity]);

   const clearActiveListItems = useCallback(() => {
      setLists((prev) =>
         prev.map((list) => {
            if (list.id !== activeListId) return list;
            return {
               ...list,
               items: [],
               total: 0,
               updatedLabel: "Just now",
            };
         })
      );
   }, [activeListId]);

   const replaceActiveListItems = useCallback((items: ActiveListItemInput[]) => {
      setLists((prev) =>
         prev.map((list) => {
            if (list.id !== activeListId) return list;
            const nextItems: ShoppingListLineItem[] = items.map((item) => ({
               id: item.id,
               name: item.name,
               price: item.price,
               quantity: Math.max(1, item.quantity ?? 1),
               store: item.store,
               image: item.image,
               retailerPrices: item.retailerPrices,
            }));
            return {
               ...list,
               items: nextItems,
               total: computeListTotal(nextItems),
               updatedLabel: "Just now",
            };
         })
      );
   }, [activeListId]);

   const getActiveList = useCallback((): ShoppingList | null => {
      if (!activeListId) return null;
      return lists.find((l) => l.id === activeListId) ?? null;
   }, [lists, activeListId]);

   const getListById = useCallback(
      (id: string) => lists.find((l) => l.id === id),
      [lists]
   );

   const value = useMemo(
      () => ({
         lists,
         activeListId,
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
      }),
      [
         lists,
         activeListId,
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
