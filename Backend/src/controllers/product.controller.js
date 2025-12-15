const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

// We now read products from the `CleanedData` database, `Coles` collection.
// This module manages its own MongoDB client so we can connect directly to
// that database while keeping the public API the same for the frontend.

const uri = process.env.MONGO_URI;

let client;
let colesCollection;

async function getColesCollection() {
  if (colesCollection) {
    return colesCollection;
  }

  if (!uri) {
    throw new Error('MONGO_URI is not defined in environment variables');
  }

  if (!client || !client.topology || client.topology.isConnected() === false) {
    client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
  }

  const db = client.db('CleanedData');
  colesCollection = db.collection('Coles');
  return colesCollection;
}

function normaliseColesProduct(product) {
  if (!product) return null;

  // Map the Coles document shape to the fields the frontend expects.
  // Example Coles fields (from screenshot):
  // - product_code
  // - category
  // - item_name
  // - best_price
  // - best_unit_price
  // - item_price
  // - unit_price
  // - link

  const currentPrice =
    product.best_price ??
    product.item_price ??
    product.current_price ??
    product.price ??
    0;

  return {
    // Preserve Mongo _id so existing keyExtractor `_id` still works.
    _id: product._id,

    // ID used elsewhere in the app (e.g. basket, search)
    product_id:
      product.product_id ??
      product.productId ??
      product.product_code ??
      null,

    // Name/title for display
    product_name:
      product.product_name ??
      product.name ??
      product.item_name ??
      'Unnamed Product',

    // We don't have a dedicated image URL in Coles data.
    // Reuse `link_image`/`image` if present; otherwise fall back to product page `link` or null.
    link_image:
      product.link_image ??
      product.image ??
      product.link ??
      null,

    // Price used throughout the UI
    current_price: currentPrice,

    // Extra fields that may be useful to callers
    category: product.category ?? null,
    best_price: product.best_price ?? null,
    best_unit_price: product.best_unit_price ?? null,
    item_price: product.item_price ?? null,
    unit_price: product.unit_price ?? null,
    link: product.link ?? null,
  };
}

// Fetch all products from CleanedData.Coles
const getProducts = async (req, res) => {
  try {
    const coles = await getColesCollection();

    // For now we ignore any search query and just return all products,
    // as the original implementation did.
    const products = await coles.find({}).toArray();

    if (!products || products.length === 0) {
      return res.status(404).json({ message: 'No products found' });
    }

    const normalised = products.map(normaliseColesProduct).filter(Boolean);
    return res.json(normalised);
  } catch (error) {
    console.error('Error fetching products from CleanedData.Coles:', error);
    return res.status(500).json({ message: 'Failed to fetch products' });
  }
};

// Fetch a single product by various possible IDs from CleanedData.Coles
const getProduct = async (req, res) => {
  try {
    const coles = await getColesCollection();

    // Incoming ID can come as `productId` or `product_id`
    const identifier = req.body.productId ?? req.body.product_id;

    if (!identifier) {
      return res.status(400).json({ message: 'Product identifier is required' });
    }

    let product = null;

    // 1. Try treating the identifier as a MongoDB _id if it's a 24-hex string
    if (typeof identifier === 'string' && /^[0-9a-fA-F]{24}$/.test(identifier)) {
      try {
        product = await coles.findOne({ _id: new ObjectId(identifier) });
      } catch (_) {
        // Ignore invalid ObjectId conversion
      }
    }

    // 2. Try matching on string-based or numeric product_code
    if (!product) {
      product = await coles.findOne({ product_code: identifier });
    }

    // 3. If identifier can be coerced to a number, try numeric product_code as well
    if (!product && (typeof identifier === 'string' || typeof identifier === 'number')) {
      const numId = Number(identifier);
      if (!Number.isNaN(numId)) {
        product = await coles.findOne({ product_code: numId });
      }
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const normalised = normaliseColesProduct(product);
    return res.json(normalised);
  } catch (error) {
    console.error('Error fetching product from CleanedData.Coles:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = { getProducts, getProduct };

