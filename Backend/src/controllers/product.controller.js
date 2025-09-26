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

// Fetch all products (with optional search + pagination)
const getProduct = async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();

    const { q, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = {};

    if (q && q.trim() !== "") {
      // Option A: use text search (requires text index)
      filter = { $text: { $search: q } };

      // Option B: if you want partial matches (like "lap" → "Laptop")
      // filter = { product_name: { $regex: q, $options: "i" } };
    }

    const products = await db.collection("product")
      .find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    if (products.length === 0) {
      return res.status(404).json({ message: "No products found" });
    }

    // Count total for pagination
    const total = await db.collection("product").countDocuments(filter);

    res.json({
      data: products,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
};


module.exports = { getProducts, getProduct };
