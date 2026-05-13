const { connectToMongoDB, getDb } = require('../config/database');
const { ObjectId } = require('mongodb');

// Fetch all products
const getProducts = async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const products = await db.collection('product').find().toArray();
    if (products.length === 0) {
      return res.status(404).json({ message: 'No products found' });
    }
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
};

// Fetch a single product by various possible IDs
const getProduct = async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();

    // Incoming ID can come as `productId` or `product_id`
    const identifier = req.body.productId ?? req.body.product_id;

    let product = null;

    // 1. Try treating the identifier as a MongoDB _id if it's a 24-hex string
    if (typeof identifier === 'string' && /^[0-9a-fA-F]{24}$/.test(identifier)) {
      try {
        product = await db.collection('product').findOne({ _id: new ObjectId(identifier) });
      } catch (_) {
        // Ignore invalid ObjectId conversion
      }
    }

    // 2. Try matching on string-based product_id
    if (!product) {
      product = await db.collection('product').findOne({ product_id: identifier });
    }

    // 3. Try matching on other potential fields (productId or product_code)
    if (!product) {
      product = await db.collection('product').findOne({ productId: identifier });
    }
    if (!product) {
      product = await db.collection('product').findOne({ product_code: identifier });
    }

    // 4. If identifier can be coerced to a number, try numeric product_id
    if (!product && (typeof identifier === 'string' || typeof identifier === 'number')) {
      const numId = Number(identifier);
      if (!isNaN(numId)) {
        product = await db.collection('product').findOne({ product_id: numId });
      }
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Return only the fields needed by the frontend
    return res.json({
      product_id: product.product_id ?? product.productId ?? product.product_code,
      product_name: product.product_name ?? product.name ?? product.productName,
      link_image: product.link_image ?? product.image ?? product.link,
      current_price: product.current_price ?? product.price ?? product.currentPrice,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = { getProducts, getProduct };
