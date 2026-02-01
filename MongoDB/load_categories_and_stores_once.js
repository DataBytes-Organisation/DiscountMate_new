/**
 * DiscountMate – One-off Categories + Stores Loader
 *
 * Run:
 *   node load_categories_and_stores_once.js
 */

require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");

// -------------------- CONNECT --------------------

async function connect() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI not set");
  }

  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000
  });
  console.log("✅ MongoDB connected");
}

// -------------------- SCHEMAS --------------------

// CATEGORY
const Category = mongoose.model(
  "category",
  new mongoose.Schema({
    category_name: { type: String, unique: true },
    description: String,
    icon_url: String,
    display_order: Number,
    is_active: Boolean,
    created_at: Date,
    updated_at: Date
  })
);

// STORE
const Store = mongoose.model(
  "store",
  new mongoose.Schema({
    store_chain: { type: String, unique: true },
    store_name: String,
    logo_url: String,
    website_url: String,
    is_active: Boolean,
    created_at: Date
  })
);

// -------------------- DATA --------------------

const now = new Date("2026-01-12T21:55:52.178Z");

// Canonical Categories (20)
const categories = [
  { category_name: "ALCOHOL", description: "Alcoholic beverages" },
  { category_name: "BABY FOOD & ACCESSORIES", description: "Items related to babies" },
  { category_name: "BAKERY", description: "Baked goods" },
  { category_name: "BEVERAGES", description: "All beverages" },
  { category_name: "CONTINENTAL", description: "All continental items" },
  { category_name: "CONVENIENCE FOOD", description: "Easy food options" },
  { category_name: "DAIRY & REFRIGERATED", description: "All fridge items including dairy" },
  { category_name: "DELI & CHILLED MEALS", description: "Items found at the deli counter or pre-prepared" },
  { category_name: "FROZEN FOODS", description: "All freezer items" },
  { category_name: "FRUIT, VEG & PRODUCE", description: "All fresh produce" },
  { category_name: "HEALTH & BEAUTY", description: "All health and beauty products, excluding foods" },
  { category_name: "HEALTH FOOD & SUPPLEMENTS", description: "All health food products" },
  { category_name: "HOUSEHOLD ITEMS", description: "All general house items" },
  { category_name: "MISCELLANEOUS", description: "Miscellaneous" },
  { category_name: "PANTRY", description: "All shelf-stable food items" },
  { category_name: "PET FOOD & ACCESSORIES", description: "All items related to pets" },
  { category_name: "POULTRY, MEAT & SEAFOOD", description: "All animal meat products" },
  { category_name: "SEASONAL", description: "All items available for limited times" },
  { category_name: "SNACKS & CONFECTIONARY", description: "All sweet and savoury, low nutritional products" },
  { category_name: "SPECIALS", description: "Specialty items" }
];

// Supermarket Stores (4)
const stores = [
  {
    store_chain: "woolworths_generic",
    store_name: "Woolworths",
    website_url: "https://www.woolworths.com.au"
  },
  {
    store_chain: "coles_generic",
    store_name: "Coles",
    website_url: "https://www.coles.com.au"
  },
  {
    store_chain: "iga_generic",
    store_name: "IGA",
    website_url: "https://www.iga.com.au"
  },
  {
    store_chain: "aldi_generic",
    store_name: "ALDI",
    website_url: "https://www.aldi.com.au"
  }
];

// -------------------- LOADERS --------------------

async function loadCategories() {
  console.log("🧹 Clearing categories collection...");

  await Category.deleteMany({});

  const docs = categories.map((c, index) => ({
    category_name: c.category_name,
    description: c.description,
    icon_url: null,
    display_order: index + 1,
    is_active: true,
    created_at: now,
    updated_at: now
  }));

  console.log(`⬆️ Inserting ${docs.length} categories...`);
  await Category.insertMany(docs);

  console.log("✅ Categories loaded");
}

async function loadStores() {
  const docs = stores.map(s => ({
    ...s,
    logo_url: null,
    is_active: true,
    created_at: now
  }));

  console.log("⬆️ Loading stores (upsert)...");

  for (const doc of docs) {
    await Store.updateOne(
      { store_chain: doc.store_chain },
      { $setOnInsert: doc },
      { upsert: true }
    );
  }

  console.log(`✅ ${docs.length} stores loaded / verified`);
}

// -------------------- RUN --------------------

(async () => {
  try {
    await connect();
    await loadCategories();
    await loadStores();
    console.log("🎉 Categories & Stores seed complete");
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
