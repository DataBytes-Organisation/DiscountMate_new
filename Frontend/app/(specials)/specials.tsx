import React, { useState } from "react";
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import FooterSection from "../../components/home/FooterSection";
import ProductGrid from "../../components/home/ProductGrid";

const { width } = Dimensions.get("window");
const isDesktop = width >= 1100;

const SPECIALS_CATEGORY_ID = "696f64f76b7787e691e7901f";

type Retailer = "Coles" | "Woolworths" | "Aldi";
type Category =
  | "Pantry"
  | "Dairy"
  | "Drinks"
  | "Frozen"
  | "Household"
  | "Snacks"
  | "Health"
  | "Pet Care"
  | "Personal Care"
  | "Bakery"
  | "Fruit & Veg";

const RETAILER_META: Record<
  Retailer,
  { color: string; light: string; icon: string }
> = {
  Coles: {
    color: "#ef4444",
    light: "#fee2e2",
    icon: "alpha-c-circle",
  },
  Woolworths: {
    color: "#22c55e",
    light: "#dcfce7",
    icon: "alpha-w-circle",
  },
  Aldi: {
    color: "#3b82f6",
    light: "#dbeafe",
    icon: "alpha-a-circle",
  },
};

const CATEGORY_COUNTS = [
  { name: "Pantry", count: 124 },
  { name: "Dairy", count: 87 },
  { name: "Drinks", count: 60 },
  { name: "Frozen", count: 65 },
  { name: "Household", count: 72 },
  { name: "Snacks", count: 91 },
  { name: "Health", count: 54 },
  { name: "Pet Care", count: 23 },
  { name: "Personal Care", count: 41 },
  { name: "Bakery", count: 31 },
  { name: "Fruit & Veg", count: 79 },
];

export default function SpecialsScreen() {
  const [selectedRetailers, setSelectedRetailers] = useState<Retailer[]>([
    "Coles",
    "Woolworths",
    "Aldi",
  ]);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);

  const toggleRetailer = (retailer: Retailer) => {
    setSelectedRetailers((prev) =>
      prev.includes(retailer)
        ? prev.filter((r) => r !== retailer)
        : [...prev, retailer]
    );
  };

  const toggleCategory = (category: Category) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.container}>
          <View style={styles.mainLayout}>
            <View style={styles.sidebar}>
              <Text style={styles.sidebarHeading}>Filter by Retailer</Text>
              {(["Coles", "Woolworths", "Aldi"] as Retailer[]).map((retailer) => {
                const active = selectedRetailers.includes(retailer);
                const meta = RETAILER_META[retailer];
                return (
                  <Pressable
                    key={retailer}
                    style={styles.checkboxRow}
                    onPress={() => toggleRetailer(retailer)}
                  >
                    <View style={[styles.checkbox, active && styles.checkboxActive]}>
                      {active ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                    </View>
                    <View style={[styles.retailerDot, { backgroundColor: meta.light }]}>
                      <MaterialCommunityIcons
                        name={meta.icon as any}
                        size={12}
                        color={meta.color}
                      />
                    </View>
                    <Text style={styles.checkboxText}>{retailer}</Text>
                  </Pressable>
                );
              })}

              <Text style={[styles.sidebarHeading, { marginTop: 20 }]}>
                Filter by Category
              </Text>

              {CATEGORY_COUNTS.map((category) => {
                const active = selectedCategories.includes(category.name as Category);
                return (
                  <Pressable
                    key={category.name}
                    style={styles.checkboxRow}
                    onPress={() => toggleCategory(category.name as Category)}
                  >
                    <View style={[styles.checkbox, active && styles.checkboxActive]}>
                      {active ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                    </View>
                    <Text style={styles.checkboxText}>{category.name}</Text>
                    <Text style={styles.countText}>({category.count})</Text>
                  </Pressable>
                );
              })}

              <Text style={[styles.sidebarHeading, { marginTop: 20 }]}>Discount Range</Text>
              {["50% or more", "40–49%", "30–39%", "20–29%", "10–19%"].map((range) => (
                <Pressable key={range} style={styles.checkboxRow}>
                  <View style={styles.checkbox} />
                  <Text style={styles.checkboxText}>{range}</Text>
                </Pressable>
              ))}

              <Pressable style={styles.resetButton}>
                <Text style={styles.resetText}>Reset All Filters</Text>
              </Pressable>
            </View>

            <View style={styles.mainContent}>
              <ProductGrid
                activeCategory={SPECIALS_CATEGORY_ID}
                useScrollView={false}
                containerClassName="flex-1 px-0 pt-0 pb-10"
              />
            </View>
          </View>
        </View>

        <View style={{ marginTop: 24 }}>
          <FooterSection disableEdgeOffset />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8faf8",
  },
  screen: {
    flex: 1,
    backgroundColor: "#f8faf8",
  },
  content: {
    paddingBottom: 0,
  },
  container: {
    width: "100%",
    maxWidth: 1400,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  mainLayout: {
    flexDirection: isDesktop ? "row" : "column",
    gap: 20,
  },
  sidebar: {
    width: isDesktop ? 260 : "100%",
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    alignSelf: "flex-start",
  },
  sidebarHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxActive: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  checkboxText: {
    fontSize: 13,
    color: "#374151",
    flexShrink: 1,
  },
  countText: {
    fontSize: 12,
    color: "#9ca3af",
    marginLeft: "auto",
  },
  resetButton: {
    marginTop: 14,
    paddingVertical: 10,
  },
  resetText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#16a34a",
  },
  retailerDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  mainContent: {
    flex: 1,
  },
});
