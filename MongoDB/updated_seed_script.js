/**
 * DiscountMate – Core Schema Seed Script (TEST DATA)
 * ERD-aligned (final, AU spelling)
 *
 * Run:
 *   node updated_seed_script.js
 *
 * Notes:
 * - Designed for dropping DB + reseeding cleanly
 * - Inserts test data for EVERY collection
 * - Uses product_id everywhere for linking where appropriate
 */

require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

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

// USER
const User = mongoose.model(
  "user",
  new mongoose.Schema({
    account_user_name: { type: String, unique: true },
    email: { type: String, unique: true },
    encrypted_password: String,
    user_fname: String,
    user_lname: String,
    address: String,
    suburb: String,
    city: String,
    longitude: Number,
    latitude: Number,
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now }
  })
);

// USER_PERSONA (1:1)
const UserPersona = mongoose.model(
  "user_persona",
  new mongoose.Schema({
    user_id: { type: ObjectId, unique: true },
    shopping_priorities: [String],
    priority_weights: Object,
    household_type: String,
    shopping_style: String,
    price_sensitivity_score: Number,
    preferred_categories: [String],
    shopping_frequency_days: Number,
    budget_category: String,
    is_organic_preferred: Boolean,
    is_brand_conscious: Boolean,
    behavioral_patterns: Object,
    created_at: Date,
    updated_at: Date,
    last_calculated_at: Date,
    calculation_method: String
  })
);

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

// SUBCATEGORY (optional / future)
const Subcategory = mongoose.model(
  "subcategory",
  new mongoose.Schema({
    category_id: ObjectId,
    subcategory_code: { type: String, unique: true },
    subcategory_name: String,
    description: String,
    display_order: Number,
    is_active: Boolean,
    created_at: Date,
    updated_at: Date
  })
);

// PRODUCT (retailer-agnostic)  ✅ UPDATED WITH INDEXES
const productSchema = new mongoose.Schema({
  product_code: { type: String, unique: true },
  product_name: String,
  description: String,
  category_id: ObjectId,
  subcategory_id: { type: ObjectId, default: null },
  brand: String,
  measurement: String,
  unit_per_prod: Number,
  link_image: String,
  link_image_side: String,
  link_image_back: String,
  gtin: String,
  created_at: Date,
  updated_at: Date
});

// ✅ Option 1 indexes
productSchema.index({ product_name: 1 });
productSchema.index({ brand: 1 });

const Product = mongoose.model("product", productSchema);

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

// PRODUCT_PRICING (retailer-specific)
const ProductPricing = mongoose.model(
  "product_pricing",
  new mongoose.Schema({
    product_id: { type: ObjectId, required: true },
    product_code: String,
    store_chain: String,
    date: Date,
    price: Number,
    best_price: Number,
    unit_price: Number,
    best_unit_price: Number,
    is_on_special: Boolean,
    link: String,
    created_at: Date
  })
);

// SHOPPING_LIST
const ShoppingList = mongoose.model(
  "shopping_list",
  new mongoose.Schema({
    user_id: ObjectId,
    list_name: String,
    is_active: Boolean,
    created_at: Date,
    updated_at: Date
  })
);

// SHOPPING_LIST_ITEM
const ShoppingListItem = mongoose.model(
  "shopping_list_item",
  new mongoose.Schema({
    shopping_list_id: ObjectId,
    product_id: { type: ObjectId, required: true },
    quantity: Number,
    unit_price: Number,
    total_price: Number,
    is_purchased: Boolean,
    added_at: Date,
    purchased_at: Date
  })
);

// FAVOURITE (AU spelling 🇦🇺)
const Favourite = mongoose.model(
  "favourite",
  new mongoose.Schema({
    user_id: ObjectId,
    product_id: { type: ObjectId, required: true },
    created_at: Date
  })
);

// USER_PREFERENCES
const UserPreferences = mongoose.model(
  "user_preferences",
  new mongoose.Schema({
    user_id: { type: ObjectId, unique: true },
    preferred_store_id: ObjectId,
    notification_email: Boolean,
    notification_push: Boolean,
    budget_limit: Number,
    dietary_restrictions: [String],
    created_at: Date,
    updated_at: Date
  })
);

// NOTIFICATION
const Notification = mongoose.model(
  "notification",
  new mongoose.Schema({
    user_id: ObjectId,
    type: String,
    title: String,
    message: String,
    data: Object,
    is_read: Boolean,
    created_at: Date
  })
);

// -------------------- SEED --------------------

async function seed() {
  const now = new Date();
  console.log("🌱 Seeding TEST data for all tables...");

  // Optional: clean collections (safe if DB already exists)
  await Promise.all([
    User.deleteMany({}),
    UserPersona.deleteMany({}),
    Category.deleteMany({}),
    Subcategory.deleteMany({}),
    Product.deleteMany({}),
    Store.deleteMany({}),
    ProductPricing.deleteMany({}),
    ShoppingList.deleteMany({}),
    ShoppingListItem.deleteMany({}),
    Favourite.deleteMany({}),
    UserPreferences.deleteMany({}),
    Notification.deleteMany({})
  ]);

  console.log("🧹 Existing collections cleared");

  // -------------------- USER --------------------
  const user = await User.create({
    account_user_name: "testuser",
    email: "testuser@example.com",
    encrypted_password: "hashed_password_123",
    user_fname: "Test",
    user_lname: "User",
    address: "123 Test Street",
    suburb: "Glen Waverley",
    city: "Melbourne",
    longitude: 145.1648,
    latitude: -37.8781,
    is_active: true,
    created_at: now
  });

  // -------------------- USER_PERSONA --------------------
  await UserPersona.create({
    user_id: user._id,
    shopping_priorities: ["price", "health", "convenience"],
    priority_weights: { price: 0.6, health: 0.25, convenience: 0.15 },
    household_type: "couple_with_kids",
    shopping_style: "weekly_bulk",
    price_sensitivity_score: 0.85,
    preferred_categories: ["Beverages", "Snacks"],
    shopping_frequency_days: 7,
    budget_category: "medium",
    is_organic_preferred: false,
    is_brand_conscious: true,
    behavioral_patterns: { buys_on_special: true, prefers_multi_buy: true },
    created_at: now,
    updated_at: now,
    last_calculated_at: now,
    calculation_method: "seed_test"
  });

  // -------------------- CATEGORY --------------------
  const categoryBeverages = await Category.create({
    category_name: "Beverages",
    description: "All drinks including soft drinks, water, juice, coffee, tea",
    icon_url: "https://example.com/icons/beverages.png",
    display_order: 1,
    is_active: true,
    created_at: now,
    updated_at: now
  });

  // -------------------- SUBCATEGORY --------------------
  const subcategorySoftDrinks = await Subcategory.create({
    category_id: categoryBeverages._id,
    subcategory_code: "SOFT_DRINKS",
    subcategory_name: "Soft Drinks",
    description: "Carbonated beverages",
    display_order: 1,
    is_active: true,
    created_at: now
  });

  // -------------------- PRODUCTS --------------------
  const productCoke = await Product.create({
    product_code: "COKE_2L",
    product_name: "Coca-Cola 2L",
    description: "Classic Coca-Cola soft drink 2L bottle",
    category_id: categoryBeverages._id,
    subcategory_id: subcategorySoftDrinks._id,
    brand: "Coca-Cola",
    measurement: "L",
    unit_per_prod: 2,
    link_image: "https://example.com/images/coke_2l_1.jpg",
    link_image_side: "https://example.com/images/coke_2l_2.jpg",
    link_image_back: "https://example.com/images/thins_175g_3.jpg",
    gtin: "9300675024235",
    created_at: now,
    updated_at: now
  });

  // -------------------- STORES --------------------
  const storeColes = await Store.create({
    store_chain: "coles",
    store_name: "Coles",
    logo_url: "https://example.com/logos/coles.png",
    website_url: "https://www.coles.com.au",
    is_active: true,
    created_at: now
  });

  // -------------------- PRODUCT_PRICING --------------------
  await ProductPricing.create([
    {
      product_id: productCoke._id,
      product_code: "COKE_2L",
      store_chain: "coles",
      date: now,
      price: 2.8,
      best_price: 2.8,
      unit_price: 1.4,
      best_unit_price: 1.4,
      is_on_special: true,
      link: "https://www.coles.com.au/product/coke-2l",
      created_at: now
    }
  ]);

  // -------------------- SHOPPING_LIST --------------------
  const list = await ShoppingList.create({
    user_id: user._id,
    list_name: "Weekly Shop (Test)",
    is_active: true,
    created_at: now,
    updated_at: now
  });

  // -------------------- SHOPPING_LIST_ITEM --------------------
  await ShoppingListItem.create([
    {
      shopping_list_id: list._id,
      product_id: productCoke._id,
      quantity: 2,
      unit_price: 2.8,
      total_price: 5.6,
      is_purchased: false,
      added_at: now,
      purchased_at: null
    }
  ]);

  // -------------------- FAVOURITE --------------------
  await Favourite.create([
    {
      user_id: user._id,
      product_id: productCoke._id,
      created_at: now
    }
  ]);

  // -------------------- USER_PREFERENCES --------------------
  await UserPreferences.create({
    user_id: user._id,
    preferred_store_id: storeColes._id,
    notification_email: true,
    notification_push: true,
    budget_limit: 250,
    dietary_restrictions: ["none"],
    created_at: now,
    updated_at: now
  });

  // -------------------- NOTIFICATION --------------------
  await Notification.create([
    {
      user_id: user._id,
      type: "price_drop",
      title: "Price Drop Alert 🎉",
      message: "Coca-Cola 2L is now on special at Coles for $2.80",
      data: {
        product_id: productCoke._id,
        store_chain: "coles",
        price: 2.8
      },
      is_read: false,
      created_at: now
    }
  ]);

  console.log("🎉 TEST seed complete (all tables populated)");
}

// -------------------- RUN --------------------

(async () => {
  try {
    await connect();

    // Optional: ensure indexes are built (helps if DB already exists)
    await Product.syncIndexes();

    await seed();
  } catch (err) {
    console.error("❌ Seed failed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
