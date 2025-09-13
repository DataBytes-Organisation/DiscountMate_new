const { connectToMongoDB } = require('../config/database');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
require('dotenv').config();

/** Decode JWT and load user */
const getUserFromToken = async (token) => {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = await connectToMongoDB();
    const user = await db.collection('users').findOne(
      { email: decoded.email },
      { projection: { encrypted_password: 0, encryped_password: 0 } }
    );
    return user || null;
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    return null;
  }
};

/** Find product in `product` collection by any likely identifier */
const resolveProduct = async (db, identifier) => {
  if (identifier === undefined || identifier === null) return null;

  // Try Mongo _id
  if (typeof identifier === 'string' && ObjectId.isValid(identifier)) {
    try {
      const byId = await db.collection('product').findOne({ _id: new ObjectId(identifier) });
      if (byId) return byId;
    } catch (_) {}
  }

  // Try common fields
  const s = String(identifier);
  let doc =
    (await db.collection('product').findOne({ productCode: s })) ||
    (await db.collection('product').findOne({ product_code: s })) ||
    (await db.collection('product').findOne({ productId: s })) ||
    (await db.collection('product').findOne({ product_id: s }));

  if (doc) return doc;

  // Numeric variants
  const n = Number(s);
  if (!Number.isNaN(n)) {
    doc =
      (await db.collection('product').findOne({ product_id: n })) ||
      (await db.collection('product').findOne({ productId: n }));
    if (doc) return doc;
  }

  return null;
};

/** Build basket response from DB, including productCode for Category matching */
const buildBasketResponse = async (db, userId) => {
  const rows = await db.collection('basket').find({ user_id: String(userId) }).toArray();
  const items = [];

  for (const row of rows) {
    const pid = row.product_id; // stored as string
    let productDoc = null;

    if (typeof pid === 'string' && ObjectId.isValid(pid)) {
      try {
        productDoc = await db.collection('product').findOne({ _id: new ObjectId(pid) });
      } catch (_) {}
    }
    if (!productDoc) {
      // fallback resolve (covers any weird stored ids)
      productDoc = await resolveProduct(db, pid);
    }

    items.push({
      productId: productDoc?._id?.toString?.() ?? String(pid),
      name: productDoc?.product_name ?? productDoc?.name ?? productDoc?.productName ?? 'Unknown Item',
      price:
        productDoc?.current_price ??
        productDoc?.price ??
        productDoc?.currentPrice ??
        0,
      image: productDoc?.link_image ?? productDoc?.image ?? productDoc?.link ?? '',
      productCode: productDoc?.productCode ?? productDoc?.product_code ?? null, // <-- added
      quantity: row.quantity ?? 1,
    });
  }

  return items;
};

/** POST /baskets/getbasket */
const getBasket = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Authorization token is required' });

    const user = await getUserFromToken(token);
    if (!user || !user._id) return res.status(401).json({ message: 'Invalid or missing user data' });

    const db = await connectToMongoDB();
    const items = await buildBasketResponse(db, user._id);
    return res.json(items);
  } catch (error) {
    console.error('Error fetching basket items:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * POST /baskets/addtobasket
 * - Accepts { product_id | productId | product_code | productCode, quantity?, name?, price?, image? }
 * - Idempotent: if item already exists for user, increments quantity instead of creating duplicates
 */
const addToBasket = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Authorization token is required' });

    const user = await getUserFromToken(token);
    if (!user || !user._id) return res.status(401).json({ message: 'Invalid or missing user data' });

    const db = await connectToMongoDB();

    let { product_id, productId, product_code, productCode, quantity = 1, name, price, image } = req.body;
    product_id = product_id ?? productId ?? null;
    product_code = product_code ?? productCode ?? null;
    quantity = Number(quantity) || 1;

    let productDoc = null;

    if (product_id) {
      productDoc = await resolveProduct(db, product_id);
    } else if (product_code) {
      productDoc = await resolveProduct(db, product_code);
    }

    // Create minimal doc if only CSV code exists
    if (!productDoc && product_code) {
      const minimal = {
        productCode: String(product_code),
        product_name: name ?? String(product_code),
        current_price: typeof price === 'number' ? price : Number(price || 0),
        link_image: image ?? '',
        createdAt: new Date(),
        source: 'csv-auto',
      };
      const ins = await db.collection('product').insertOne(minimal);
      productDoc = { _id: ins.insertedId, ...minimal };
    }

    if (!productDoc || !productDoc._id) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const canonicalId = productDoc._id.toString();
    const filter = { user_id: user._id.toString(), product_id: canonicalId };

    // Idempotent upsert: increment if exists, else insert
    const existing = await db.collection('basket').findOne(filter);
    if (existing) {
      await db.collection('basket').updateOne(filter, { $set: { quantity: (existing.quantity ?? 1) + quantity } });
    } else {
      await db.collection('basket').insertOne({ ...filter, quantity });
    }

    const items = await buildBasketResponse(db, user._id);
    return res.status(201).json(items);
  } catch (error) {
    console.error('Error adding item to basket:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

/** POST /baskets/updatequantity  or PUT /baskets/updatebasketquantity */
const updateQuantity = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Authorization token is required' });

    const user = await getUserFromToken(token);
    if (!user || !user._id) return res.status(401).json({ message: 'Invalid or missing user data' });

    const db = await connectToMongoDB();

    let { productId, product_id, product_code, quantity } = req.body;
    quantity = Math.max(1, Number(quantity) || 1);

    // Resolve canonical Mongo id
    let canonicalId = null;
    const incoming = productId ?? product_id ?? null;
    if (incoming) {
      if (typeof incoming === 'string' && ObjectId.isValid(incoming)) {
        canonicalId = incoming;
      } else {
        const doc = await resolveProduct(db, incoming);
        if (doc && doc._id) canonicalId = doc._id.toString();
      }
    } else if (product_code) {
      const doc = await resolveProduct(db, product_code);
      if (doc && doc._id) canonicalId = doc._id.toString();
    }

    if (!canonicalId) return res.status(404).json({ message: 'Product not found.' });

    const filter = { user_id: user._id.toString(), product_id: String(canonicalId) };
    await db.collection('basket').updateOne(filter, { $set: { quantity } });

    const items = await buildBasketResponse(db, user._id);
    return res.json(items);
  } catch (error) {
    console.error('Error updating quantity in basket:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

/** DELETE /baskets/deleteitemfrombasket */
const deleteFromBasket = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Authorization token is required' });

    const user = await getUserFromToken(token);
    if (!user || !user._id) return res.status(401).json({ message: 'Invalid or missing user data' });

    const db = await connectToMongoDB();
    const { productId, product_id, product_code } = req.body;

    let canonicalId = null;
    const incoming = productId ?? product_id ?? null;
    if (incoming) {
      if (typeof incoming === 'string' && ObjectId.isValid(incoming)) {
        canonicalId = incoming;
      } else {
        const doc = await resolveProduct(db, incoming);
        if (doc && doc._id) canonicalId = doc._id.toString();
      }
    } else if (product_code) {
      const doc = await resolveProduct(db, product_code);
      if (doc && doc._id) canonicalId = doc._id.toString();
    }

    if (!canonicalId) return res.status(404).json({ message: 'Product not found.' });

    await db.collection('basket').deleteOne({ user_id: user._id.toString(), product_id: String(canonicalId) });

    const items = await buildBasketResponse(db, user._id);
    return res.json(items);
  } catch (error) {
    console.error('Error deleting item from basket:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = { getBasket, addToBasket, updateQuantity, deleteFromBasket };
