import { useState, useCallback, useMemo } from "react";

export type PriceRange = {
   label: string;
   min: number | null;
   max: number | null;
};

export type SortOption = "best-savings" | "price-low-high" | "price-high-low" | "name-a-z";

export type ProductFilters = {
   priceRange: { min: number | null; max: number | null };
   retailers: string[];
   sortBy: SortOption;
};

const DEFAULT_FILTERS: ProductFilters = {
   priceRange: { min: null, max: null },
   retailers: [],
   sortBy: "best-savings",
};

export const PRICE_RANGES: PriceRange[] = [
   { label: "Under $5", min: 0, max: 5 },
   { label: "$5 - $10", min: 5, max: 10 },
   { label: "$10 - $20", min: 10, max: 20 },
   { label: "$20 - $50", min: 20, max: 50 },
   { label: "Over $50", min: 50, max: null },
];

export const RETAILERS = [
   { key: "coles", label: "Coles", count: 342 },
   { key: "woolworths", label: "Woolworths", count: 318 },
   { key: "aldi", label: "ALDI", count: 156 },
   { key: "iga", label: "IGA", count: 89 },
];

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
   { value: "best-savings", label: "Best Savings" },
   { value: "price-low-high", label: "Price: Low to High" },
   { value: "price-high-low", label: "Price: High to Low" },
   { value: "name-a-z", label: "Name: A-Z" },
];

export function useProductFilters(initial: Partial<ProductFilters> = {}) {
   const [filters, setFilters] = useState<ProductFilters>({
      ...DEFAULT_FILTERS,
      ...initial,
   });

   const toggleRetailer = useCallback((retailerKey: string) => {
      setFilters((prev) => {
         const isSelected = prev.retailers.includes(retailerKey);
         return {
            ...prev,
            retailers: isSelected
               ? prev.retailers.filter((r) => r !== retailerKey)
               : [...prev.retailers, retailerKey],
         };
      });
   }, []);

   const selectPriceRange = useCallback((range: PriceRange | null) => {
      setFilters((prev) => ({
         ...prev,
         priceRange: range ? { min: range.min, max: range.max } : { min: null, max: null },
      }));
   }, []);

   const setSortBy = useCallback((sortBy: SortOption) => {
      setFilters((prev) => ({ ...prev, sortBy }));
   }, []);

   const resetAll = useCallback(() => {
      setFilters(DEFAULT_FILTERS);
   }, []);

   const activeFilterCount = useMemo(() => {
      let count = filters.retailers.length;
      if (filters.priceRange.min !== null || filters.priceRange.max !== null) count += 1;
      return count;
   }, [filters]);

   return {
      filters,
      toggleRetailer,
      selectPriceRange,
      setSortBy,
      resetAll,
      activeFilterCount,
   };
}