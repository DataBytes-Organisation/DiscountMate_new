import React, { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

type RetailerOption = {
   label: string;
   value: string;
   count?: number;
};

type SidebarFiltersProps = {
   onFiltersChange?: (filters: {
      priceRange: { min: number | null; max: number | null };
      retailers: string[];
   }) => void;
};

const RETAILERS: RetailerOption[] = [
   { label: "Coles", value: "coles", count: 342 },
   { label: "Woolworths", value: "woolworths", count: 318 },
   { label: "ALDI", value: "aldi", count: 156 },
   { label: "IGA", value: "iga", count: 89 },
];

const PRICE_RANGES = [
   { label: "Under $5", min: 0, max: 5 },
   { label: "$5 - $10", min: 5, max: 10 },
   { label: "$10 - $20", min: 10, max: 20 },
   { label: "$20 - $50", min: 20, max: 50 },
   { label: "Over $50", min: 50, max: null },
];

export default function SidebarFilters({
   onFiltersChange,
}: SidebarFiltersProps) {
   const [priceRange, setPriceRange] = useState<{
      min: number | null;
      max: number | null;
   }>({ min: null, max: null });
   const [selectedRetailers, setSelectedRetailers] = useState<string[]>([]);
   const [isPriceRangeExpanded, setIsPriceRangeExpanded] = useState<boolean>(true);
   const [isRetailerExpanded, setIsRetailerExpanded] = useState<boolean>(true);

   const toggleRetailer = (retailerValue: string) => {
      const newRetailers = selectedRetailers.includes(retailerValue)
         ? selectedRetailers.filter((r) => r !== retailerValue)
         : [...selectedRetailers, retailerValue];
      setSelectedRetailers(newRetailers);
      notifyFiltersChange({ priceRange, retailers: newRetailers });
   };

   const selectPriceRange = (min: number | null, max: number | null) => {
      // If clicking the same range that's already selected, uncheck it
      const isCurrentlySelected = priceRange.min === min && priceRange.max === max;
      const newPriceRange = isCurrentlySelected
         ? { min: null, max: null }
         : { min, max };
      setPriceRange(newPriceRange);
      notifyFiltersChange({ priceRange: newPriceRange, retailers: selectedRetailers });
   };

   const notifyFiltersChange = (filters: {
      priceRange: { min: number | null; max: number | null };
      retailers: string[];
   }) => {
      onFiltersChange?.(filters);
   };

   const resetAllFilters = () => {
      setPriceRange({ min: null, max: null });
      setSelectedRetailers([]);
      const emptyFilters = {
         priceRange: { min: null, max: null },
         retailers: [],
      };
      notifyFiltersChange(emptyFilters);
   };

   const hasActiveFilters =
      (priceRange.min !== null || priceRange.max !== null) ||
      selectedRetailers.length > 0;

   return (
      <View
         style={{
            position: "sticky" as any,
            top: 0,
            alignSelf: "flex-start",
            maxHeight: "100vh",
         }}
         className="hidden md:flex w-64"
      >
         <View className="flex-1 bg-white border-r border-gray-100 shadow-sm overflow-hidden">
            <ScrollView
               style={{ flex: 1 }}
               contentContainerStyle={{
                  paddingVertical: 24,
                  paddingHorizontal: 16,
               }}
               showsVerticalScrollIndicator={true}
            >
               <View className="flex-row items-center justify-between mb-6">
                  <Text className="text-xs text-gray-500 uppercase tracking-[0.15em]">
                     Refine Your Search
                  </Text>
                  {hasActiveFilters && (
                     <Pressable onPress={resetAllFilters}>
                        <Text className="text-xs text-primary_green font-medium">
                           Reset All
                        </Text>
                     </Pressable>
                  )}
               </View>

               {/* Price Range Filter */}
               <View className="mb-6">
                  <Pressable
                     onPress={() => setIsPriceRangeExpanded(!isPriceRangeExpanded)}
                     className="flex-row items-center justify-between mb-3"
                  >
                     <Text className="text-sm font-semibold text-gray-900">
                        Price Range
                     </Text>
                     <FontAwesome6
                        name={isPriceRangeExpanded ? "chevron-up" : "chevron-down"}
                        size={12}
                        color="#6B7280"
                     />
                  </Pressable>
                  {isPriceRangeExpanded && (
                     <View className="space-y-2">
                        {PRICE_RANGES.map((range) => {
                           const isSelected =
                              priceRange.min === range.min &&
                              priceRange.max === range.max;

                           return (
                              <Pressable
                                 key={range.label}
                                 onPress={() => selectPriceRange(range.min, range.max)}
                                 className={[
                                    "flex-row items-center justify-between px-3 py-2 rounded-lg mb-1",
                                    isSelected
                                       ? "bg-[#E5F7F0]"
                                       : "bg-transparent hover:bg-gray-50",
                                 ].join(" ")}
                              >
                                 <View className="flex-row items-center flex-1">
                                    <View
                                       className={[
                                          "w-4 h-4 rounded border-2 mr-3 items-center justify-center",
                                          isSelected
                                             ? "border-primary_green bg-primary_green"
                                             : "border-gray-300 bg-white",
                                       ].join(" ")}
                                    >
                                       {isSelected && (
                                          <FontAwesome6
                                             name="check"
                                             size={10}
                                             color="#FFFFFF"
                                          />
                                       )}
                                    </View>
                                    <Text
                                       className={[
                                          "text-sm",
                                          isSelected
                                             ? "text-primary_green font-medium"
                                             : "text-gray-700",
                                       ].join(" ")}
                                    >
                                       {range.label}
                                    </Text>
                                 </View>
                              </Pressable>
                           );
                        })}
                     </View>
                  )}
               </View>

               {/* Retailer Filter */}
               <View className="mb-6">
                  <Pressable
                     onPress={() => setIsRetailerExpanded(!isRetailerExpanded)}
                     className="flex-row items-center justify-between mb-3"
                  >
                     <Text className="text-sm font-semibold text-gray-900">
                        Retailer
                     </Text>
                     <FontAwesome6
                        name={isRetailerExpanded ? "chevron-up" : "chevron-down"}
                        size={12}
                        color="#6B7280"
                     />
                  </Pressable>
                  {isRetailerExpanded && (
                     <View className="space-y-2">
                        {RETAILERS.map((retailer) => {
                           const isSelected = selectedRetailers.includes(retailer.value);

                           return (
                              <Pressable
                                 key={retailer.value}
                                 onPress={() => toggleRetailer(retailer.value)}
                                 className={[
                                    "flex-row items-center justify-between px-3 py-2 rounded-lg mb-1",
                                    isSelected
                                       ? "bg-[#E5F7F0]"
                                       : "bg-transparent hover:bg-gray-50",
                                 ].join(" ")}
                              >
                                 <View className="flex-row items-center flex-1">
                                    <View
                                       className={[
                                          "w-4 h-4 rounded border-2 mr-3 items-center justify-center",
                                          isSelected
                                             ? "border-primary_green bg-primary_green"
                                             : "border-gray-300 bg-white",
                                       ].join(" ")}
                                    >
                                       {isSelected && (
                                          <FontAwesome6
                                             name="check"
                                             size={10}
                                             color="#FFFFFF"
                                          />
                                       )}
                                    </View>
                                    <Text
                                       className={[
                                          "text-sm",
                                          isSelected
                                             ? "text-primary_green font-medium"
                                             : "text-gray-700",
                                       ].join(" ")}
                                    >
                                       {retailer.label}
                                    </Text>
                                 </View>
                                 {retailer.count !== undefined && (
                                    <Text className="text-xs text-gray-500 ml-2">
                                       ({retailer.count})
                                    </Text>
                                 )}
                              </Pressable>
                           );
                        })}
                     </View>
                  )}
               </View>
            </ScrollView>
         </View>
      </View>
   );
}
