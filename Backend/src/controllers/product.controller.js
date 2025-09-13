const { connectToMongoDB, getDb } = require('../config/database');
const { ObjectId } = require('mongodb');

// ---------- getProducts: now supports ?db=&collection=&category=&limit= and ?sources=db.coll,db2.coll2 ----------
const getProducts = async (req, res) => {
  try {
    await connectToMongoDB();
    const baseDb = getDb();

    // Try to get a Mongo client from the db handle
    const client = baseDb.client || baseDb.s?.client;
    if (!client) {
      console.error('Mongo client not available from getDb()');
      // Fallback: original behavior
      const products = await baseDb.collection('product').find().toArray();
      return res.json(products);
    }

    const limit = Math.max(1, Math.min(1000, parseInt(String(req.query.limit || '100'), 10) || 100));
    const category = (req.query.category || '').toString().trim();

    // Build a permissive category filter across common field names
    const catFilter = category
      ? {
          $or: [
            { category: category },
            { Category: category },
            { categories: category },
            { 'category.name': category },
          ],
        }
      : {};

    // Helper to fetch from any db/collection
    const fetchFrom = async (dbName, collName, filter, lim) => {
      const db = dbName ? client.db(dbName) : baseDb;
      return db.collection(collName).find(filter || {}).limit(lim || limit).toArray();
    };

    // 1) Explicit db+collection request: /api/products?db=CleanedData&collection=Coles&category=Pantry
    const dbName = req.query.db ? String(req.query.db) : null;
    const collName = req.query.collection ? String(req.query.collection) : null;
    if (dbName && collName) {
      const docs = await fetchFrom(dbName, collName, catFilter, limit);
      return res.json(docs);
    }

    // 2) Multiple sources: /api/products?sources=DiscountMate.product,CleanedData.Coles&limit=500
    const sourcesRaw = (req.query.sources || '').toString().trim();
    if (sourcesRaw) {
      const sources = sourcesRaw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const chunks = [];
      for (const src of sources) {
        const [sdb, scoll] = src.split('.');
        if (!scoll) {
          // If only a collection is given, assume current/base DB
          chunks.push(await fetchFrom(null, sdb, catFilter, limit));
        } else {
          chunks.push(await fetchFrom(sdb, scoll, catFilter, limit));
        }
      }
      // Flatten; if you want to hard cap overall limit, slice here:
      const merged = chunks.flat();
      return res.json(merged);
    }

    // 3) Default (unchanged): legacy 'product' collection
    const products = await baseDb.collection('product').find().limit(limit).toArray();
    if (!products?.length) return res.status(404).json({ message: 'No products found' });
    return res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
};

// ---------- getProduct: already updated to search both DBs ----------
const getProduct = async (req, res) => {
  try {
    await connectToMongoDB();

    const baseDb = getDb();
    const client = baseDb.client || baseDb.s?.client;
    if (!client) throw new Error('Mongo client not available from getDb()');

    const colesDb = client.db('CleanedData');
    const coles = colesDb.collection('Coles');

    // Incoming ID can come as productId or product_id
    const identifier = req.body.productId ?? req.body.product_id;
    if (!identifier) return res.status(400).json({ message: 'Missing productId' });

    const asStr = String(identifier);
    const isHex24 = /^[0-9a-fA-F]{24}$/.test(asStr);
    const asNum = Number(asStr);
    const isNum = !Number.isNaN(asNum);

    let product = null;

    // 1) Try legacy "product"
    if (isHex24) {
      try {
        product = await baseDb.collection('product').findOne({ _id: new ObjectId(asStr) });
      } catch (_) {}
    }
    if (!product) product = await baseDb.collection('product').findOne({ product_id: asStr });
    if (!product && isNum) product = await baseDb.collection('product').findOne({ product_id: asNum });
    if (!product) product = await baseDb.collection('product').findOne({ productId: asStr });
    if (!product) product = await baseDb.collection('product').findOne({ product_code: asStr });

    // 2) Fallback: CleanedData.Coles
    if (!product) {
      if (isHex24) {
        try {
          product = await coles.findOne({ _id: new ObjectId(asStr) });
        } catch (_) {}
      }
      if (!product) product = await coles.findOne({ product_code: asStr });
      if (!product && isNum) product = await coles.findOne({ product_id: asNum });
      if (!product) product = await coles.findOne({ productId: asStr });
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const stableId =
      product.product_id ??
      product.productId ??
      product.product_code ??
      (product._id ? String(product._id) : undefined);

    return res.json({
      product_id: String(stableId),
      product_name: product.product_name ?? product.name ?? product.item_name ?? '',
      link_image: product.link_image ?? product.image ?? product.link ?? '',
      current_price: Number(product.current_price ?? product.item_price ?? product.best_price ?? product.price ?? 0),
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = { getProducts, getProduct };
