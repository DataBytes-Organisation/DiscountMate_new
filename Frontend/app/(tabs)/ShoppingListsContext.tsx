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
import type { ShoppingList, ShoppingListAccent } from "../../types/ShoppingList";

const STORAGE_KEY = "@discountmate_shopping_lists_v1";

type PersistedShape = {
   lists: ShoppingList[];
   activeListId: string | null;
};

function seedLists(): ShoppingList[] {
   return [
      {
         id: "list_seed_weekly",
         name: "Weekly Essentials",
         description: "Regular top-up shop",
         accent: "emerald",
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

type ShoppingListsContextValue = {
   lists: ShoppingList[];
   activeListId: string | null;
   setActiveList: (id: string) => void;
   createList: (input: CreateListInput) => ShoppingList;
   updateList: (id: string, input: Partial<CreateListInput>) => void;
   deleteList: (id: string) => void;
   getActiveList: () => ShoppingList | null;
   getListById: (id: string) => ShoppingList | undefined;
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
                  setLists(parsed.lists);
                  setActiveListIdState(parsed.activeListId ?? parsed.lists[0].id);
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
         updatedLabel: "Just now",
         total: 0,
         savings: 0,
         items: [],
      };
      setLists((prev) => [...prev, list]);
      setActiveListIdState(list.id);
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
         const next = prev.filter((l) => l.id !== id);
         setActiveListIdState((current) =>
            current === id ? next[0]?.id ?? null : current
         );
         return next;
      });
   }, []);

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
