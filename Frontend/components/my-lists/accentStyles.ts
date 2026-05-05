import type { ShoppingListAccent } from "../../types/ShoppingList";

/** Tailwind-oriented class fragments for list accent (borders / soft fills) */
export const accentRing: Record<ShoppingListAccent, string> = {
   emerald: "border-emerald-200 bg-emerald-50/60",
   amber: "border-amber-200 bg-amber-50/60",
   sky: "border-sky-200 bg-sky-50/60",
   violet: "border-violet-200 bg-violet-50/60",
   rose: "border-rose-200 bg-rose-50/60",
};

export const accentDot: Record<ShoppingListAccent, string> = {
   emerald: "bg-emerald-500",
   amber: "bg-amber-500",
   sky: "bg-sky-500",
   violet: "bg-violet-500",
   rose: "bg-rose-500",
};

export const accentBar: Record<ShoppingListAccent, string> = {
   emerald: "bg-emerald-500",
   amber: "bg-amber-500",
   sky: "bg-sky-500",
   violet: "bg-violet-500",
   rose: "bg-rose-500",
};
