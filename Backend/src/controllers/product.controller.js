const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI;

let client;
let colesCollection;
let productPricingsCollection;

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

  const db = client.db('DiscountMate_DB');
  colesCollection = db.collection('products');
  return colesCollection;
}

async function getProductPricingsCollection() {
  if (productPricingsCollection) {
    return productPricingsCollection;
  }

  if (!uri) {
    throw new Error('MONGO_URI is not defined in environment variables');
  }

  if (!client || !client.topology || client.topology.isConnected() === false) {
    client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
  }

  const db = client.db('DiscountMate_DB');
  productPricingsCollection = db.collection('product_pricings');
  return productPricingsCollection;
}

function normaliseColesProduct(product, latestPricing = null) {
  if (!product) return null;

  // Use current_price from product_pricings (latest pricing)
  // If no pricing exists, set to 0
  const currentPrice =
    (latestPricing && typeof latestPricing.current_price === 'number' && !isNaN(latestPricing.current_price))
      ? latestPricing.current_price
      : 0;

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

    // Description
    description: product.description ?? null,

    // Reuse `link_image`/`image` if present; otherwise fall back to product page `link` or null.
    link_image:
      product.link_image ??
      product.image ??
      product.link ??
      null,

    // Price used throughout the UI - from product_pricings only, or 0 if no pricing exists
    current_price: currentPrice,

    // Extra fields that may be useful to callers
    category: product.category ?? null,
    link: product.link ?? null,
  };
}

// Fetch products from DiscountMate_DB.products with latest pricing from product_pricings
const getProducts = async (req, res) => {
  try {
    const coles = await getColesCollection();
    const pricings = await getProductPricingsCollection();

    // Basic search support (by name/category) – optional and intentionally lightweight so we can still use indexes effectively if they are added.
    const { search, category } = req.query || {};
    const query = {};

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { product_name: regex },
        { name: regex },
        { item_name: regex },
      ];
    }

    if (category && typeof category === 'string' && category.trim().length > 0) {
      // Match category case-insensitively while keeping index-friendly equality when possible.
      // Normalise by trimming whitespace and matching the whole value.
      const trimmed = category.trim();
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.category = { $regex: new RegExp(`^${escaped}$`, 'i') };
    }

    // Standardize response structure: always return an object with items array
    // and pagination metadata for consistent client handling.
    const { page, limit, pageSize } = req.query || {};
    const hasPagingParams = Boolean(page || limit || pageSize);

    // Get total count for pagination metadata (before aggregation)
    const total = await coles.countDocuments(query);

    // Build aggregation pipeline to join with product_pricings and get latest pricing
    const pipeline = [
      // Match products based on query
      { $match: query },

      // Join with product_pricings collection
      {
        $lookup: {
          from: 'product_pricings',
          localField: '_id',
          foreignField: 'product_id',
          as: 'pricings'
        }
      },

      // Unwind pricings array (preserve products without pricings)
      {
        $unwind: {
          path: '$pricings',
          preserveNullAndEmptyArrays: true
        }
      },

      // Sort by collected_at (or created_datetime as fallback) descending to get latest first
      {
        $sort: {
          'pricings.collected_at': -1,
          'pricings.created_datetime': -1
        }
      },

      // Group by product _id to get only the latest pricing
      {
        $group: {
          _id: '$_id',
          product: { $first: '$$ROOT' },
          latestPricing: { $first: '$pricings' }
        }
      },

      // Restore product structure with latest pricing, excluding the unwound pricings field
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              {
                $arrayToObject: {
                  $filter: {
                    input: { $objectToArray: '$product' },
                    cond: { $ne: ['$$this.k', 'pricings'] }
                  }
                }
              },
              { latestPricing: '$latestPricing' }
            ]
          }
        }
      },

      // Add a sort key field using the first available name field (for case-insensitive sorting)
      {
        $addFields: {
          sortName: {
            $toLower: {
              $ifNull: [
                '$product_name',
                { $ifNull: ['$name', { $ifNull: ['$item_name', ''] }] }
              ]
            }
          }
        }
      },

      // Sort products alphabetically by name (case-insensitive)
      {
        $sort: {
          sortName: 1,
          _id: 1
        }
      },

      // Remove the temporary sort key field
      {
        $project: {
          sortName: 0
        }
      }
    ];

    // Add pagination after grouping (on final product set)
    if (hasPagingParams) {
      const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
      const rawPageSize =
        parseInt(limit, 10) || parseInt(pageSize, 10) || 30;
      const pageSizeNumber = Math.min(Math.max(rawPageSize, 1), 100);

      pipeline.push(
        { $skip: (pageNumber - 1) * pageSizeNumber },
        { $limit: pageSizeNumber }
      );
    }

    const products = await coles.aggregate(pipeline).toArray();

    if (!products || products.length === 0) {
      const totalPages = hasPagingParams
        ? Math.max(1, Math.ceil(total / (parseInt(limit, 10) || parseInt(pageSize, 10) || 30)))
        : 0;

      return res.status(404).json({
        message: 'No products found',
        items: [],
        page: hasPagingParams ? (Math.max(parseInt(page, 10) || 1, 1)) : 1,
        pageSize: hasPagingParams ? (parseInt(limit, 10) || parseInt(pageSize, 10) || 30) : total,
        total: 0,
        totalPages,
      });
    }

    // Normalize products with latest pricing
    const normalised = products.map(product => {
      const latestPricing = product.latestPricing || null;
      return normaliseColesProduct(product, latestPricing);
    }).filter(Boolean);

    if (!hasPagingParams) {
      return res.json({
        items: normalised,
        page: 1,
        pageSize: normalised.length,
        total: normalised.length,
        totalPages: 1,
      });
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const rawPageSize =
      parseInt(limit, 10) || parseInt(pageSize, 10) || 30;
    const pageSizeNumber = Math.min(Math.max(rawPageSize, 1), 100);
    const totalPages = Math.max(1, Math.ceil(total / pageSizeNumber));

    return res.json({
      items: normalised,
      page: pageNumber,
      pageSize: pageSizeNumber,
      total,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching products from DiscountMate_DB.products:', error);
    return res.status(500).json({ message: 'Failed to fetch products' });
  }
};

// Fetch a single product by various possible IDs from DiscountMate_DB.products with latest pricing
const getProduct = async (req, res) => {
  try {
    const coles = await getColesCollection();
    const pricings = await getProductPricingsCollection();

    // Incoming ID can come as `productId` or `product_id`
    const identifier = req.body.productId ?? req.body.product_id;

    if (!identifier) {
      return res.status(400).json({ message: 'Product identifier is required' });
    }

    let product = null;
    let productId = null;

    // 1. Try treating the identifier as a MongoDB _id if it's a 24-hex string
    if (typeof identifier === 'string' && /^[0-9a-fA-F]{24}$/.test(identifier)) {
      try {
        productId = new ObjectId(identifier);
        product = await coles.findOne({ _id: productId });
      } catch (_) {
        // Ignore invalid ObjectId conversion
      }
    }

    // 2. Try matching on product_id (for products like "P001")
    if (!product) {
      product = await coles.findOne({ product_id: identifier });
      if (product) {
        productId = product._id;
      }
    }

    // 3. Try matching on string-based or numeric product_code
    if (!product) {
      product = await coles.findOne({ product_code: identifier });
      if (product) {
        productId = product._id;
      }
    }

    // 4. If identifier can be coerced to a number, try numeric product_code as well
    if (!product && (typeof identifier === 'string' || typeof identifier === 'number')) {
      const numId = Number(identifier);
      if (!Number.isNaN(numId)) {
        product = await coles.findOne({ product_code: numId });
        if (product) {
          productId = product._id;
        }
      }
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Get latest pricing for this product
    const latestPricing = await pricings
      .find({ product_id: product._id })
      .sort({ collected_at: -1, created_datetime: -1 })
      .limit(1)
      .toArray();

    const pricing = latestPricing && latestPricing.length > 0 ? latestPricing[0] : null;
    const normalised = normaliseColesProduct(product, pricing);
    return res.json(normalised);
  } catch (error) {
    console.error('Error fetching product from DiscountMate_DB.products:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = { getProducts, getProduct };

