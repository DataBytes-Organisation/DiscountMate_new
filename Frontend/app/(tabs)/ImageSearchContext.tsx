import React, { createContext, useContext, useState } from "react";

export type ImageSearchResult = {
   rank: number;
   product_id: string;
   name: string;
   similarity_score: number;
   image_url: string;
   price_now: string | null;
   price_was: string | null;
   price_comparable: string | null;
};

type ImageSearchContextType = {
   results: ImageSearchResult[];
   setResults: (results: ImageSearchResult[]) => void;
   clearResults: () => void;
};

const ImageSearchContext = createContext<ImageSearchContextType | null>(null);

export const ImageSearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
   const [results, setResults] = useState<ImageSearchResult[]>([]);
   const clearResults = () => setResults([]);

   return (
      <ImageSearchContext.Provider value={{ results, setResults, clearResults }}>
         {children}
      </ImageSearchContext.Provider>
   );
};

export const useImageSearch = () => {
   const ctx = useContext(ImageSearchContext);
   if (!ctx) throw new Error("useImageSearch must be used within ImageSearchProvider");
   return ctx;
};
