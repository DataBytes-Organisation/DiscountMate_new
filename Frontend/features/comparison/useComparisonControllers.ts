import { useCallback, useEffect, useRef, useState } from "react";
import {
   ComparisonRequestError,
   createGroceryComparisonRun,
   fetchProductComparison,
   searchComparisonProducts,
   trackComparisonEvents,
} from "../../services/comparisons";
import type {
   ComparisonObjective,
   ComparisonProduct,
   GroceryComparisonRun,
   ProductComparison,
} from "../../types/Comparison";

export function useProductComparisonController() {
   const [query, setQuery] = useState("");
   const [results, setResults] = useState<ComparisonProduct[]>([]);
   const [selectedProduct, setSelectedProduct] = useState<ComparisonProduct | null>(null);
   const [comparison, setComparison] = useState<ProductComparison | null>(null);
   const range = "3m";
   const [includeSimilar, setIncludeSimilar] = useState(true);
   const [retailerIds, setRetailerIds] = useState<string[]>([]);
   const [availableRetailers, setAvailableRetailers] = useState<{ id: string; name: string }[]>([]);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [errorCode, setErrorCode] = useState<string | null>(null);

   useEffect(() => {
      const trimmed = query.trim();
      if (trimmed.length < 2 || selectedProduct?.name === trimmed) {
         setResults([]);
         return;
      }
      const timer = setTimeout(() => {
         void searchComparisonProducts(trimmed)
            .then(setResults)
            .catch(() => setResults([]));
      }, 250);
      return () => clearTimeout(timer);
   }, [query, selectedProduct]);

   const load = useCallback(async (
      product = selectedProduct,
      nextRange = range,
      nextRetailers = retailerIds,
      nextSimilar = includeSimilar
   ) => {
      if (!product) return;
      setLoading(true);
      setError(null);
      setErrorCode(null);
      try {
         const next = await fetchProductComparison(product.id, {
            range: nextRange,
            retailerIds: nextRetailers,
            includeSimilar: nextSimilar,
         });
         setComparison(next);
         setAvailableRetailers((current) => {
            const merged = new Map(current.map((item) => [item.id, item]));
            next.offers.forEach((offer) => merged.set(offer.retailerId, {
               id: offer.retailerId,
               name: offer.retailerName,
            }));
            return Array.from(merged.values());
         });
         void trackComparisonEvents([{ name: "comparison_viewed", properties: { mode: "single_product", productId: product.id } }]);
      } catch (cause) {
         setError(cause instanceof Error ? cause.message : "Comparison failed.");
         setErrorCode(cause instanceof ComparisonRequestError ? cause.code : "comparison_unavailable");
         void trackComparisonEvents([{ name: "comparison_failed", properties: { mode: "single_product", productId: product.id } }]);
      } finally {
         setLoading(false);
      }
   }, [includeSimilar, range, retailerIds, selectedProduct]);

   const selectProduct = useCallback((product: ComparisonProduct) => {
      setSelectedProduct(product);
      setQuery(product.name);
      setResults([]);
      setRetailerIds([]);
      setAvailableRetailers([]);
      void load(product, range, [], includeSimilar);
      void trackComparisonEvents([{ name: "product_selected", properties: { productId: product.id } }]);
   }, [includeSimilar, load, range]);

   const toggleSimilar = useCallback((value: boolean) => {
      setIncludeSimilar(value);
      void load(selectedProduct, range, retailerIds, value);
      void trackComparisonEvents([{ name: "similar_products_toggled", properties: { enabled: value } }]);
   }, [load, range, retailerIds, selectedProduct]);

   const toggleRetailer = useCallback((id: string) => {
      const next = retailerIds.includes(id)
         ? retailerIds.filter((value) => value !== id)
         : [...retailerIds, id];
      setRetailerIds(next);
      void load(selectedProduct, range, next, includeSimilar);
      void trackComparisonEvents([{ name: "retailer_filter_changed", properties: { retailerIds: next } }]);
   }, [includeSimilar, load, range, retailerIds, selectedProduct]);

   const clearRetailers = useCallback(() => {
      setRetailerIds([]);
      void load(selectedProduct, range, [], includeSimilar);
   }, [includeSimilar, load, range, selectedProduct]);

   const clear = useCallback(() => {
      setQuery("");
      setSelectedProduct(null);
      setComparison(null);
      setResults([]);
      setError(null);
      setErrorCode(null);
      setRetailerIds([]);
   }, []);

   return {
      query, setQuery, results, selectedProduct, comparison, range, includeSimilar,
      retailerIds, availableRetailers, loading, error, errorCode, selectProduct, toggleSimilar,
      toggleRetailer, clearRetailers, clear, retry: load,
   };
}

export function useGroceryComparisonController(listId: string | null) {
   const [objective, setObjective] = useState<ComparisonObjective>("lowest_total");
   const [maxRetailers, setMaxRetailers] = useState<1 | 2 | 3>(2);
   const [allowStoreBrandSubstitutions, setAllowStoreBrandSubstitutions] = useState(true);
   const [run, setRun] = useState<GroceryComparisonRun | null>(null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [errorCode, setErrorCode] = useState<string | null>(null);
   const requestId = useRef(0);

   const execute = useCallback(async (delay = 0, throwOnError = false) => {
      if (!listId) return null;
      const currentRequest = ++requestId.current;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (currentRequest !== requestId.current) return null;
      setLoading(true);
      setError(null);
      setErrorCode(null);
      try {
         const next = await createGroceryComparisonRun(listId, {
            objective,
            maxRetailers,
            allowStoreBrandSubstitutions,
         });
         if (currentRequest === requestId.current) setRun(next);
         void trackComparisonEvents([{ name: "comparison_run_completed", properties: { runId: next.id, objective } }]);
         return next;
      } catch (cause) {
         if (currentRequest === requestId.current) {
            setError(cause instanceof Error ? cause.message : "List comparison failed.");
            setErrorCode(cause instanceof ComparisonRequestError ? cause.code : "comparison_unavailable");
         }
         if (throwOnError) throw cause;
         return null;
      } finally {
         if (currentRequest === requestId.current) setLoading(false);
      }
   }, [allowStoreBrandSubstitutions, listId, maxRetailers, objective]);

   useEffect(() => {
      if (!listId) {
         setRun(null);
         return;
      }
      const timer = setTimeout(() => void execute(), 200);
      return () => clearTimeout(timer);
   }, [execute, listId]);

   const updateObjective = useCallback((value: ComparisonObjective) => {
      setObjective(value);
      void trackComparisonEvents([{ name: "optimizer_changed", properties: { objective: value } }]);
   }, []);

   return {
      objective, setObjective: updateObjective, maxRetailers, setMaxRetailers,
      allowStoreBrandSubstitutions, setAllowStoreBrandSubstitutions,
      run, setRun, loading, error, errorCode, execute, clear: () => setRun(null),
   };
}
