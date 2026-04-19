export type ShoppingListAccent = "emerald" | "amber" | "sky" | "violet" | "rose";

export type ShoppingListLineItem = {
   id: string;
   name: string;
   price: number;
   quantity: number;
};

export type ShoppingList = {
   id: string;
   name: string;
   description: string;
   accent: ShoppingListAccent;
   /** Display string until real timestamps come from the API */
   updatedLabel: string;
   items: ShoppingListLineItem[];
   total: number;
   savings: number;
};

export type ShoppingListAnalytics = {
   itemCount: number;
   total: number;
   savings: number;
   savingsPercent: number;
   /** Placeholder category split for UI — replace with API aggregates later */
   categoryMix: { label: string; percent: number }[];
};

export function listAnalytics(list: ShoppingList): ShoppingListAnalytics {
   const itemCount = list.items.reduce((n, i) => n + i.quantity, 0);
   const savings = list.savings;
   const total = list.total;
   const savingsPercent = total + savings > 0 ? (savings / (total + savings)) * 100 : 0;

   return {
      itemCount,
      total,
      savings,
      savingsPercent,
      categoryMix: [
         { label: "Pantry & dry goods", percent: 38 },
         { label: "Fresh", percent: 27 },
         { label: "Dairy & fridge", percent: 21 },
         { label: "Other", percent: 14 },
      ],
   };
}
