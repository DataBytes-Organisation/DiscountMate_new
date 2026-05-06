import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Dimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const isDesktop = width >= 1100;
const isTablet = width >= 768;

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

type DealItem = {
  id: string;
  retailer: Retailer;
  category: Category;
  name: string;
  variant: string;
  regularPrice: number;
  specialPrice: number;
  badge?: string;
  daysLeft: string;
};

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

const MOCK_DEALS: DealItem[] = [
  {
    id: "1",
    retailer: "Coles",
    category: "Pantry",
    name: "Premium Chocolate Assortment 500g",
    variant: "Rich Belgian blend",
    regularPrice: 19.99,
    specialPrice: 7.99,
    badge: "Trending down",
    daysLeft: "Ends in 2 days",
  },
  {
    id: "2",
    retailer: "Woolworths",
    category: "Pantry",
    name: "Lotus Virgin Olive Oil Extra 1L",
    variant: "Cold pressed",
    regularPrice: 15.0,
    specialPrice: 8.99,
    badge: "Hot deal",
    daysLeft: "Ends in 4 days",
  },
  {
    id: "3",
    retailer: "Aldi",
    category: "Pantry",
    name: "Premium Coffee Beans 1kg",
    variant: "Medium roast",
    regularPrice: 31.0,
    specialPrice: 11.99,
    badge: "Trending down",
    daysLeft: "Ends in 5 days",
  },
  {
    id: "4",
    retailer: "Coles",
    category: "Household",
    name: "Laundry Detergent 4L",
    variant: "Fresh cotton",
    regularPrice: 31.0,
    specialPrice: 14.99,
    badge: "Hot deal",
    daysLeft: "Ends in 3 days",
  },
  {
    id: "5",
    retailer: "Woolworths",
    category: "Pantry",
    name: "Pasta Variety Pack",
    variant: "500g x 3 pack",
    regularPrice: 8.5,
    specialPrice: 5.49,
    daysLeft: "Ends in 4 days",
  },
  {
    id: "6",
    retailer: "Coles",
    category: "Pantry",
    name: "Rice 5kg Bag",
    variant: "Long grain",
    regularPrice: 12.5,
    specialPrice: 8.99,
    daysLeft: "Ends in 2 days",
  },
  {
    id: "7",
    retailer: "Aldi",
    category: "Pantry",
    name: "Canned Tomatoes 4pk",
    variant: "Italian style",
    regularPrice: 4.8,
    specialPrice: 3.99,
    daysLeft: "Ends in 4 days",
  },
  {
    id: "8",
    retailer: "Coles",
    category: "Pantry",
    name: "Cooking Oil 2L",
    variant: "Sunflower oil",
    regularPrice: 8.9,
    specialPrice: 6.49,
    daysLeft: "Ends in 3 days",
  },
  {
    id: "9",
    retailer: "Woolworths",
    category: "Pantry",
    name: "Flour 2kg",
    variant: "Plain flour",
    regularPrice: 5.4,
    specialPrice: 3.99,
    daysLeft: "Ends in 1 day",
  },
  {
    id: "10",
    retailer: "Coles",
    category: "Dairy",
    name: "Cheese Block 500g",
    variant: "Tasty cheddar",
    regularPrice: 9.9,
    specialPrice: 5.79,
    daysLeft: "Ends in 3 days",
  },
  {
    id: "11",
    retailer: "Woolworths",
    category: "Dairy",
    name: "Full Cream Milk 2L",
    variant: "Farm fresh",
    regularPrice: 4.2,
    specialPrice: 3.1,
    daysLeft: "Ends in 2 days",
  },
  {
    id: "12",
    retailer: "Coles",
    category: "Dairy",
    name: "Greek Yogurt 1kg",
    variant: "Natural",
    regularPrice: 12.0,
    specialPrice: 6.84,
    daysLeft: "Ends in 6 days",
  },
  {
    id: "13",
    retailer: "Aldi",
    category: "Dairy",
    name: "Butter 500g",
    variant: "Salted",
    regularPrice: 7.2,
    specialPrice: 4.75,
    daysLeft: "Ends in 4 days",
  },
  {
    id: "14",
    retailer: "Woolworths",
    category: "Dairy",
    name: "Cream Cheese",
    variant: "Spreadable",
    regularPrice: 7.5,
    specialPrice: 4.19,
    daysLeft: "Ends in 5 days",
  },
  {
    id: "15",
    retailer: "Coles",
    category: "Household",
    name: "Toilet Paper 24pk",
    variant: "Soft 3 ply",
    regularPrice: 22.0,
    specialPrice: 12.99,
    daysLeft: "Ends in 2 days",
  },
  {
    id: "16",
    retailer: "Woolworths",
    category: "Household",
    name: "Paper Towels 6pk",
    variant: "Extra absorbent",
    regularPrice: 12.0,
    specialPrice: 8.39,
    daysLeft: "Ends in 1 day",
  },
  {
    id: "17",
    retailer: "Aldi",
    category: "Household",
    name: "Dishwasher Tablets 40pk",
    variant: "Lemon",
    regularPrice: 21.0,
    specialPrice: 14.69,
    daysLeft: "Ends in 6 days",
  },
  {
    id: "18",
    retailer: "Coles",
    category: "Household",
    name: "Surface Cleaner 2L",
    variant: "Citrus",
    regularPrice: 9.8,
    specialPrice: 5.49,
    daysLeft: "Ends in 3 days",
  },
  {
    id: "19",
    retailer: "Woolworths",
    category: "Household",
    name: "Bin Bags 100pk",
    variant: "Drawstring",
    regularPrice: 8.4,
    specialPrice: 5.99,
    daysLeft: "Ends in 4 days",
  },
  {
    id: "20",
    retailer: "Coles",
    category: "Dairy",
    name: "Premium Ice Cream 2L Tub",
    variant: "Vanilla bean flavour",
    regularPrice: 15.0,
    specialPrice: 7.99,
    badge: "Trending down",
    daysLeft: "Ends in 3 days",
  },
  {
    id: "21",
    retailer: "Woolworths",
    category: "Pantry",
    name: "Breakfast Cereal Family Pack 750g",
    variant: "Honey oat crunch",
    regularPrice: 8.99,
    specialPrice: 5.1,
    badge: "Hot deal",
    daysLeft: "Ends in 5 days",
  },
  {
    id: "22",
    retailer: "Aldi",
    category: "Pantry",
    name: "Organic Honey 500g Jar",
    variant: "Pure Australian honey",
    regularPrice: 12.99,
    specialPrice: 7.79,
    badge: "Trending down",
    daysLeft: "Ends in 6 days",
  },
];

const FILTER_CHIPS = [
  "Cheapest Today",
  "On Special",
  "Trending Down",
  "High Savings",
  "Bulk Deals",
  "More...",
];

const SORT_OPTIONS = ["Biggest Discount", "Price Low-High", "Newest"];

const iconForSection = (category: Category) => {
  switch (category) {
    case "Pantry":
      return "basket-outline";
    case "Dairy":
      return "water-outline";
    case "Household":
      return "home-outline";
    default:
      return "pricetag-outline";
  }
};

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function saving(item: DealItem) {
  return item.regularPrice - item.specialPrice;
}

function ProductCard({ item }: { item: DealItem }) {
  const retailer = RETAILER_META[item.retailer];

  return (
    <View style={styles.productCard}>
      <Pressable style={styles.wishlistButton}>
        <Ionicons name="heart-outline" size={14} color="#9ca3af" />
      </Pressable>

      <View style={styles.productImagePlaceholder}>
        <Text style={styles.placeholderText}>Product Image</Text>
      </View>

      <View style={styles.retailerRow}>
        <View style={[styles.retailerDot, { backgroundColor: retailer.light }]}>
          <MaterialCommunityIcons
            name={retailer.icon as any}
            size={12}
            color={retailer.color}
          />
        </View>
        <Text style={styles.retailerText}>{item.retailer}</Text>
      </View>

      <Text numberOfLines={2} style={styles.productName}>
        {item.name}
      </Text>
      <Text style={styles.productVariant}>{item.variant}</Text>

      <View style={styles.priceRow}>
        <Text style={styles.specialPrice}>{money(item.specialPrice)}</Text>
        <View>
          <Text style={styles.oldPrice}>{money(item.regularPrice)}</Text>
          <Text style={styles.saveText}>Save {money(saving(item))}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        {item.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        ) : (
          <View />
        )}
        <Text style={styles.daysLeft}>{item.daysLeft}</Text>
      </View>

      <Pressable style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Add to Basket</Text>
      </Pressable>
    </View>
  );
}

function CompactDealRow({ item }: { item: DealItem }) {
  const retailer = RETAILER_META[item.retailer];

  return (
    <View style={styles.compactRow}>
      <View style={styles.compactLeft}>
        <View style={styles.compactImage}>
          <Text style={styles.placeholderText}>Product Image</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.retailerRow}>
            <View style={[styles.retailerDot, { backgroundColor: retailer.light }]}>
              <MaterialCommunityIcons
                name={retailer.icon as any}
                size={12}
                color={retailer.color}
              />
            </View>
            <Text style={styles.retailerText}>{item.retailer}</Text>
          </View>

          <Text style={styles.compactName}>{item.name}</Text>
          <Text style={styles.productVariant}>{item.variant}</Text>

          <View style={styles.compactMeta}>
            {item.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            ) : null}
            <Text style={styles.daysLeft}>{item.daysLeft}</Text>
          </View>
        </View>
      </View>

      <View style={styles.compactPrices}>
        <Text style={styles.compactLabel}>Regular Price</Text>
        <Text style={styles.oldPrice}>{money(item.regularPrice)}</Text>
      </View>

      <View style={styles.compactPrices}>
        <Text style={styles.compactLabel}>Special Price</Text>
        <Text style={styles.specialPrice}>{money(item.specialPrice)}</Text>
      </View>

      <View style={styles.compactPrices}>
        <Text style={styles.compactLabel}>You Save</Text>
        <Text style={styles.saveBig}>{money(saving(item))}</Text>
      </View>

      <Pressable style={[styles.primaryButton, { minWidth: 120 }]}>
        <Text style={styles.primaryButtonText}>Add to Basket</Text>
      </Pressable>
    </View>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      <Pressable>
        <Text style={styles.viewAll}>View all</Text>
      </Pressable>
    </View>
  );
}

export default function SpecialsScreen() {
  const [query, setQuery] = useState("");
  const [activeChip, setActiveChip] = useState("On Special");
  const [selectedRetailers, setSelectedRetailers] = useState<Retailer[]>([
    "Coles",
    "Woolworths",
    "Aldi",
  ]);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [sortBy, setSortBy] = useState("Biggest Discount");

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

  const filteredDeals = useMemo(() => {
    let data = [...MOCK_DEALS];

    if (selectedRetailers.length) {
      data = data.filter((item) => selectedRetailers.includes(item.retailer));
    }

    if (selectedCategories.length) {
      data = data.filter((item) => selectedCategories.includes(item.category));
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      data = data.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.variant.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.retailer.toLowerCase().includes(q)
      );
    }

    if (activeChip === "Cheapest Today") {
      data.sort((a, b) => a.specialPrice - b.specialPrice);
    } else if (activeChip === "High Savings" || sortBy === "Biggest Discount") {
      data.sort((a, b) => saving(b) - saving(a));
    } else if (sortBy === "Price Low-High") {
      data.sort((a, b) => a.specialPrice - b.specialPrice);
    }

    return data;
  }, [query, selectedRetailers, selectedCategories, activeChip, sortBy]);

  const topDeals = filteredDeals.slice(0, 4);
  const pantryDeals = filteredDeals.filter((d) => d.category === "Pantry").slice(0, 5);
  const dairyDeals = filteredDeals.filter((d) => d.category === "Dairy").slice(0, 5);
  const householdDeals = filteredDeals
    .filter((d) => d.category === "Household")
    .slice(0, 5);
  const listDeals = filteredDeals.slice(0, 3);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.container}>
          <View style={styles.topTabs}>
            {FILTER_CHIPS.map((chip) => {
              const active = chip === activeChip;
              return (
                <Pressable
                  key={chip}
                  onPress={() => setActiveChip(chip)}
                  style={[styles.topChip, active && styles.topChipActive]}
                >
                  <Text style={[styles.topChipText, active && styles.topChipTextActive]}>
                    {chip}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#9ca3af" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search for products, brands, or categories..."
                placeholderTextColor="#9ca3af"
                style={styles.input}
              />
            </View>

            <Pressable style={styles.searchButton}>
              <Text style={styles.searchButtonText}>Search</Text>
            </Pressable>
          </View>

          <Text style={styles.pageEyebrow}>🔥 This Week’s Specials</Text>
          <Text style={styles.pageTitle}>Current Specials & Discounts</Text>
          <Text style={styles.pageDescription}>
            Browse the latest deals across all major retailers. Updated daily with
            new specials and exclusive offers.
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>847</Text>
              <Text style={styles.statLabel}>Active Specials</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: "#f59e0b" }]}>$42.80</Text>
              <Text style={styles.statLabel}>Avg Savings</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>3</Text>
              <Text style={styles.statLabel}>Retailers</Text>
            </View>
          </View>

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
              <View style={styles.toolbar}>
                <View style={styles.toolbarLeft}>
                  <View style={styles.toolbarPill}>
                    <Ionicons name="filter" size={14} color="#6b7280" />
                    <Text style={styles.toolbarPillText}>More Filters</Text>
                  </View>

                  <Text style={styles.showingText}>
                    Showing specials <Text style={styles.showingBold}>847</Text> deals
                  </Text>

                  <View style={styles.toolbarPill}>
                    <Text style={styles.toolbarPillText}>Relevance</Text>
                  </View>

                  <View style={styles.toolbarPill}>
                    <Text style={styles.toolbarPillText}>All</Text>
                  </View>
                </View>

                <Pressable
                  style={styles.sortPill}
                  onPress={() =>
                    setSortBy((prev) =>
                      prev === SORT_OPTIONS[0]
                        ? SORT_OPTIONS[1]
                        : prev === SORT_OPTIONS[1]
                        ? SORT_OPTIONS[2]
                        : SORT_OPTIONS[0]
                    )
                  }
                >
                  <Text style={styles.toolbarPillText}>Sort by {sortBy}</Text>
                </Pressable>
              </View>

              <View style={styles.heroBanner}>
                <View style={{ flex: 1 }}>
                  <View style={styles.featuredPill}>
                    <Ionicons name="star" size={12} color="#fff" />
                    <Text style={styles.featuredPillText}>Featured Deal</Text>
                  </View>

                  <Text style={styles.heroTitle}>Massive Savings This Week</Text>
                  <Text style={styles.heroSubtitle}>
                    Up to 60% off selected items across all categories
                  </Text>

                  <View style={styles.heroBottom}>
                    <View>
                      <Text style={styles.heroSmallLabel}>Ends in</Text>
                      <Text style={styles.heroSmallValue}>3 days 14 hours</Text>
                    </View>

                    <Pressable style={styles.heroButton}>
                      <Text style={styles.heroButtonText}>Shop Featured Deals</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.heroPlaceholder}>
                  <Text style={styles.heroPlaceholderText}>Featured Banner</Text>
                </View>
              </View>

              <SectionHeader
                title="Top Deals - Biggest Discounts"
                subtitle="Best value offers right now"
              />

              <View style={styles.grid}>
                {topDeals.map((item) => (
                  <ProductCard key={item.id} item={item} />
                ))}
              </View>

              <SectionHeader
                title="Pantry Specials"
                subtitle={`${pantryDeals.length} items on special`}
              />

              <View style={styles.grid}>
                {pantryDeals.map((item) => (
                  <ProductCard key={item.id} item={item} />
                ))}
              </View>

              <SectionHeader
                title="Dairy Specials"
                subtitle={`${dairyDeals.length} items on special`}
              />

              <View style={styles.grid}>
                {dairyDeals.map((item) => (
                  <ProductCard key={item.id} item={item} />
                ))}
              </View>

              <SectionHeader
                title="Household Specials"
                subtitle={`${householdDeals.length} items on special`}
              />

              <View style={styles.grid}>
                {householdDeals.map((item) => (
                  <ProductCard key={item.id} item={item} />
                ))}
              </View>

              <View style={styles.allSpecialsHeader}>
                <View>
                  <Text style={styles.sectionTitle}>All Current Specials</Text>
                  <Text style={styles.sectionSubtitle}>
                    Browse the complete specials list
                  </Text>
                </View>

                <View style={styles.viewToggleRow}>
                  <View style={styles.viewToggle}>
                    <Ionicons name="grid-outline" size={14} color="#6b7280" />
                    <Text style={styles.viewToggleText}>Grid View</Text>
                  </View>
                  <View style={[styles.viewToggle, styles.viewToggleActive]}>
                    <Ionicons name="list-outline" size={14} color="#16a34a" />
                    <Text style={[styles.viewToggleText, { color: "#16a34a" }]}>
                      List View
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.compactList}>
                {listDeals.map((item) => (
                  <CompactDealRow key={item.id} item={item} />
                ))}
              </View>

              <View style={styles.pagination}>
                <Pressable style={styles.pageButton}>
                  <Ionicons name="chevron-back" size={14} color="#6b7280" />
                </Pressable>
                {[1, 2, 3].map((page) => (
                  <Pressable
                    key={page}
                    style={[styles.pageButton, page === 1 && styles.pageButtonActive]}
                  >
                    <Text
                      style={[
                        styles.pageButtonText,
                        page === 1 && styles.pageButtonTextActive,
                      ]}
                    >
                      {page}
                    </Text>
                  </Pressable>
                ))}
                <Text style={styles.pageDots}>...</Text>
                <Pressable style={styles.pageButton}>
                  <Text style={styles.pageButtonText}>12</Text>
                </Pressable>
                <Pressable style={styles.pageButton}>
                  <Ionicons name="chevron-forward" size={14} color="#6b7280" />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerColLarge}>
              <View style={styles.brandRow}>
                <View style={styles.brandBadge}>
                  <Ionicons name="pricetag" size={14} color="#fff" />
                </View>
                <Text style={styles.footerBrand}>DiscountMate</Text>
              </View>
              <Text style={styles.footerText}>
                Compare prices across major retailers and never miss a deal. Save
                money on your grocery shopping with Australia’s leading price
                comparison platform.
              </Text>
              <View style={styles.socialRow}>
                {["logo-facebook", "logo-twitter", "logo-instagram", "logo-linkedin"].map(
                  (icon) => (
                    <View key={icon} style={styles.socialIcon}>
                      <Ionicons name={icon as any} size={14} color="#e5e7eb" />
                    </View>
                  )
                )}
              </View>
            </View>

            <View style={styles.footerCol}>
              <Text style={styles.footerHeading}>Quick Links</Text>
              {["Home", "Compare Prices", "Specials", "My Lists", "Profile"].map((item) => (
                <Text key={item} style={styles.footerLink}>
                  {item}
                </Text>
              ))}
            </View>

            <View style={styles.footerCol}>
              <Text style={styles.footerHeading}>Support</Text>
              {["Help Center", "Contact Us", "FAQs", "Privacy Policy", "Terms of Service"].map(
                (item) => (
                  <Text key={item} style={styles.footerLink}>
                    {item}
                  </Text>
                )
              )}
            </View>

            <View style={styles.footerCol}>
              <Text style={styles.footerHeading}>Newsletter</Text>
              <Text style={styles.footerText}>
                Get weekly updates on the best deals directly to your inbox.
              </Text>
              <View style={styles.newsletterRow}>
                <TextInput
                  placeholder="Your email"
                  placeholderTextColor="#9ca3af"
                  style={styles.newsletterInput}
                />
                <Pressable style={styles.newsletterButton}>
                  <Ionicons name="arrow-forward" size={14} color="#fff" />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const CARD_WIDTH = isDesktop ? "23.5%" : isTablet ? "31.8%" : "100%";

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
    paddingBottom: 40,
  },
  container: {
    width: "100%",
    maxWidth: 1400,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  topTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  topChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  topChipActive: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  topChipText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
  },
  topChipTextActive: {
    color: "#fff",
  },
  searchRow: {
    flexDirection: isTablet ? "row" : "column",
    gap: 12,
    marginBottom: 20,
  },
  searchBox: {
    flex: 1,
    minHeight: 48,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    outlineStyle: "none" as any,
  },
  searchButton: {
    minWidth: 120,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  searchButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  pageEyebrow: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6b7280",
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  pageDescription: {
    fontSize: 15,
    lineHeight: 24,
    color: "#6b7280",
    maxWidth: 760,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 24,
  },
  statCard: {
    minWidth: 150,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  statValue: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
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
  mainContent: {
    flex: 1,
  },
  toolbar: {
    flexDirection: isTablet ? "row" : "column",
    justifyContent: "space-between",
    alignItems: isTablet ? "center" : "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  toolbarLeft: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  toolbarPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toolbarPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4b5563",
  },
  showingText: {
    fontSize: 12,
    color: "#6b7280",
  },
  showingBold: {
    fontWeight: "700",
    color: "#111827",
  },
  sortPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  heroBanner: {
    borderRadius: 22,
    padding: 22,
    backgroundColor: "#16a34a",
    flexDirection: isTablet ? "row" : "column",
    gap: 18,
    marginBottom: 28,
    shadowColor: "#166534",
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  featuredPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  featuredPillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    marginBottom: 18,
  },
  heroBottom: {
    flexDirection: "row",
    gap: 18,
    alignItems: "center",
    flexWrap: "wrap",
  },
  heroSmallLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  heroSmallValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  heroButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  heroButtonText: {
    color: "#166534",
    fontWeight: "700",
    fontSize: 13,
  },
  heroPlaceholder: {
    width: isTablet ? 260 : "100%",
    minHeight: 150,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroPlaceholderText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
  },
  sectionHeader: {
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  viewAll: {
    color: "#16a34a",
    fontWeight: "700",
    fontSize: 13,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 28,
  },
  productCard: {
    width: CARD_WIDTH as any,
    minWidth: isDesktop ? 210 : 0,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    position: "relative",
  },
  wishlistButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  productImagePlaceholder: {
    height: 118,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  placeholderText: {
    color: "#c4c7ce",
    fontSize: 12,
    fontWeight: "600",
  },
  retailerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  retailerDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  retailerText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
  },
  productName: {
    fontSize: 14,
    lineHeight: 20,
    color: "#111827",
    fontWeight: "700",
    minHeight: 40,
    marginBottom: 4,
  },
  productVariant: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  specialPrice: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  oldPrice: {
    fontSize: 12,
    color: "#9ca3af",
    textDecorationLine: "line-through",
    textAlign: "right",
  },
  saveText: {
    fontSize: 12,
    color: "#16a34a",
    fontWeight: "700",
    marginTop: 2,
    textAlign: "right",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  badge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    color: "#15803d",
    fontWeight: "700",
  },
  daysLeft: {
    fontSize: 11,
    color: "#6b7280",
  },
  primaryButton: {
    height: 38,
    borderRadius: 10,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  allSpecialsHeader: {
    marginTop: 4,
    marginBottom: 14,
    flexDirection: isTablet ? "row" : "column",
    gap: 12,
    justifyContent: "space-between",
    alignItems: isTablet ? "center" : "flex-start",
  },
  viewToggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  viewToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  viewToggleActive: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  viewToggleText: {
    fontSize: 12,
    color: "#4b5563",
    fontWeight: "600",
  },
  compactList: {
    gap: 12,
  },
  compactRow: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    flexDirection: isDesktop ? "row" : "column",
    gap: 14,
    alignItems: isDesktop ? "center" : "stretch",
  },
  compactLeft: {
    flex: 1,
    flexDirection: "row",
    gap: 14,
  },
  compactImage: {
    width: 92,
    height: 92,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  compactName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  compactMeta: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 6,
    flexWrap: "wrap",
  },
  compactPrices: {
    minWidth: 100,
  },
  compactLabel: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 6,
  },
  saveBig: {
    fontSize: 22,
    color: "#16a34a",
    fontWeight: "800",
  },
  pagination: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  pageButton: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  pageButtonActive: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  pageButtonText: {
    color: "#4b5563",
    fontWeight: "600",
    fontSize: 12,
  },
  pageButtonTextActive: {
    color: "#fff",
  },
  pageDots: {
    color: "#9ca3af",
    fontWeight: "700",
    marginHorizontal: 2,
  },
  footer: {
    marginTop: 34,
    backgroundColor: "#111827",
    borderRadius: 24,
    padding: 24,
    flexDirection: isDesktop ? "row" : "column",
    gap: 24,
  },
  footerColLarge: {
    flex: 1.4,
  },
  footerCol: {
    flex: 1,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  brandBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  footerBrand: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "800",
  },
  footerText: {
    fontSize: 13,
    lineHeight: 22,
    color: "#9ca3af",
    marginBottom: 14,
  },
  socialRow: {
    flexDirection: "row",
    gap: 10,
  },
  socialIcon: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  footerHeading: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 12,
  },
  footerLink: {
    color: "#d1d5db",
    fontSize: 13,
    marginBottom: 10,
  },
  newsletterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  newsletterInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 12,
    color: "#fff",
    fontSize: 13,
    outlineStyle: "none" as any,
  },
  newsletterButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
});