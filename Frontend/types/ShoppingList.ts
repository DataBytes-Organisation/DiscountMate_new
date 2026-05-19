export type ShoppingListAccent = "emerald" | "amber" | "sky" | "violet" | "rose";

export type ShoppingListLineItem = {
   id: string;
   name: string;
   price: number;
   quantity: number;
   store?: string;
   image?: string;
   category?: string;
   categoryId?: string;
   retailerPrices?: {
      aldi?: number;
      coles?: number;
      woolworths?: number;
      iga?: number;
   };
};

export type ShoppingList = {
   id: string;
   name: string;
   description: string;
   accent: ShoppingListAccent;
   /** Display string until real timestamps come from the API */
   createdLabel: string;
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
      categoryMix: getCategoryMix(list.items),
   };
}

function getCategoryMix(items: ShoppingListLineItem[]) {
   const counts = items.reduce<Record<string, number>>((acc, item) => {
      const label = item.category?.trim() || "Uncategorised";
      acc[label] = (acc[label] ?? 0) + item.quantity;
      return acc;
   }, {});

   const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
   if (total <= 0) return [];

   return Object.entries(counts)
      .map(([label, count]) => ({
         label,
         percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.percent - a.percent || a.label.localeCompare(b.label));
}
