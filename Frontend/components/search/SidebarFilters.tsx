import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import FilterCheckboxGroup from "../common/FilterCheckboxGroup";
import {
  PRICE_RANGES,
  RETAILERS,
  ProductFilters,
} from "../../hooks/useProductFilters";

type SidebarFiltersProps = {
  filters: ProductFilters;
  toggleRetailer: (retailerKey: string) => void;
  selectPriceRange: (
    range: { label: string; min: number | null; max: number | null } | null,
  ) => void;
  resetAll: () => void;
  activeFilterCount: number;
};

export default function SidebarFilters({
  filters,
  toggleRetailer,
  selectPriceRange,
  resetAll,
  activeFilterCount,
}: SidebarFiltersProps) {
  const [isPriceRangeExpanded, setIsPriceRangeExpanded] = React.useState(true);
  const [isRetailerExpanded, setIsRetailerExpanded] = React.useState(true);

  const selectedPriceLabel = PRICE_RANGES.find(
    (r) => r.min === filters.priceRange.min && r.max === filters.priceRange.max,
  )?.label;

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
            {activeFilterCount > 0 && (
              <Pressable onPress={resetAll}>
                <Text className="text-xs text-primary_green font-medium">
                  Reset All
                </Text>
              </Pressable>
            )}
          </View>

          <FilterCheckboxGroup
            title="Price Range"
            options={PRICE_RANGES.map((r) => ({
              key: r.label,
              label: r.label,
            }))}
            selectedKeys={selectedPriceLabel ? [selectedPriceLabel] : []}
            onToggle={(key) => {
              const range = PRICE_RANGES.find((r) => r.label === key);
              const isSame = selectedPriceLabel === key;
              selectPriceRange(isSame ? null : (range ?? null));
            }}
            expanded={isPriceRangeExpanded}
            onToggleExpanded={() => setIsPriceRangeExpanded((prev) => !prev)}
          />

          <FilterCheckboxGroup
            title="Retailer"
            options={RETAILERS.map((r) => ({
              key: r.key,
              label: r.label,
              count: r.count,
            }))}
            selectedKeys={filters.retailers}
            onToggle={toggleRetailer}
            expanded={isRetailerExpanded}
            onToggleExpanded={() => setIsRetailerExpanded((prev) => !prev)}
          />
        </ScrollView>
      </View>
    </View>
  );
}
