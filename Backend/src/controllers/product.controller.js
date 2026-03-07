const { ObjectId } = require('mongodb');
const { getDb } = require("../config/database");

function escapeRegex(input) {
   return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normaliseColesProduct(product, latestPricing = null) {
  if (!product) return null;

  // Use current_price from product_pricings (latest pricing)
  // If no pricing exists, set to 0
   const currentPrice =
      (latestPricing && typeof latestPricing.price === 'number' && !isNaN(latestPricing.price))
         ? latestPricing.price
         : 0;

  return {
    // Preserve Mongo _id so existing keyExtractor `_id` still works.
    _id: product._id,

    // Name/title for display
    product_name:
      product.product_name ??
      product.name ??
      product.item_name ??
      'Unnamed Product',

    // Stable join key for pricing + external references
    product_code: product.product_code ?? null,

    // Brand / barcode (exists in your products collection)
    brand: product.brand ?? null,
    gtin: product.gtin ?? null,

    // Pack size (exists in your products collection)
    unit_per_prod: product.unit_per_prod ?? null,
    measurement: product.measurement ?? null,

    // Category reference (exists in your products collection)
    category_id: product.category_id ?? null,

    // Description
    description: product.description ?? null,

    // Product image URL
    link_image:
      product.link_image ??
      product.image ??
      null,

    // Additional product image URLs (optional)
    image_link_back: product.image_link_back ?? null,
    image_link_side: product.image_link_side ?? null,

    // Price used throughout the UI - from product_pricings only, or 0 if no pricing exists
    current_price: currentPrice,

    // Latest pricing metadata (exists in product_pricings collection)
    store_chain: latestPricing?.store_chain ?? null,
    price_date: latestPricing?.date ?? null,
    best_price: latestPricing?.best_price ?? null,
    unit_price: latestPricing?.unit_price ?? null,
    best_unit_price: latestPricing?.best_unit_price ?? null,
    is_on_special: latestPricing?.is_on_special ?? null,

    // Timestamps
    created_at: product.created_at ?? null,
    updated_at: product.updated_at ?? null,
    pricing_created_at: latestPricing?.created_at ?? null,
  };
}

const getProducts = async (req, res) => {
   try {
      const db = getDb();
      const coles = db.collection("products");

      const { search, category } = req.query || {};

      const pageNumber = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const rawPageSize =
         parseInt(req.query.limit, 10) || parseInt(req.query.pageSize, 10) || 30;
      const pageSizeNumber = Math.min(Math.max(rawPageSize, 1), 100);

      const match = { product_code: { $exists: true, $ne: null } };

      if (search && typeof search === "string" && search.trim()) {
         const regex = new RegExp(escapeRegex(search.trim()), "i");
         match.$or = [
            { product_name: regex },
            { brand: regex },
         ];
      }

      // category can be category_id OR category_name
      let wantsCategoryName = false;
      let categoryName = null;

      if (category && typeof category === "string" && category.trim()) {
         const c = category.trim();

         if (ObjectId.isValid(c)) {
            match.category_id = new ObjectId(c);
         } else {
            wantsCategoryName = true;
            categoryName = c;
         }
      }

      const escapedCategoryName = categoryName
         ? categoryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
         : null;

      const categoryNameRegex = escapedCategoryName
         ? new RegExp(`^${escapedCategoryName}$`, "i")
         : null;

      const categoryNameStages = wantsCategoryName
         ? [
            {
               $lookup: {
                  from: "categories",
                  localField: "category_id",
                  foreignField: "_id",
                  as: "cat",
               },
            },
            { $unwind: { path: "$cat", preserveNullAndEmptyArrays: false } },
            {
               $match: {
                  "cat.category_name": categoryNameRegex,
               },
            },
         ]
         : [];

      const basePipeline = [
         { $match: match },

         // Only if category is a name
         ...categoryNameStages,

         // Compute sort key and sort BEFORE pagination
         {
            $addFields: {
               sortName: {
                  $toLower: {
                     $ifNull: [
                        "$product_name",
                        { $ifNull: ["$name", { $ifNull: ["$item_name", ""] }] },
                     ],
                  },
               },
            },
         },
         { $sort: { sortName: 1, _id: 1 } },

         // Paginate products
         { $skip: (pageNumber - 1) * pageSizeNumber },
         { $limit: pageSizeNumber },

         // Lookup latest pricing for only this page
         {
            $lookup: {
               from: "product_pricings",
               let: { code: "$product_code" },
               pipeline: [
                  { $match: { $expr: { $eq: ["$product_code", "$$code"] } } },
                  { $sort: { date: -1, created_at: -1 } },
                  { $limit: 1 },
               ],
               as: "latestPricingArr",
            },
         },
         { $addFields: { latestPricing: { $arrayElemAt: ["$latestPricingArr", 0] } } },
         { $project: { latestPricingArr: 0, sortName: 0 } },
      ];

      const countPipeline = [
         { $match: match },
         ...categoryNameStages,
         { $count: "total" },
      ];

      const [items, totalArr] = await Promise.all([
         coles.aggregate(basePipeline, { allowDiskUse: true }).toArray(),
         coles.aggregate(countPipeline, { allowDiskUse: true }).toArray(),
      ]);

      const total = totalArr?.[0]?.total || 0;
      const totalPages = total === 0 ? 0 : Math.ceil(total / pageSizeNumber);

      const normalised = items
         .map((p) => normaliseColesProduct(p, p.latestPricing || null))
         .filter(Boolean);

      return res.json({
         items: normalised,
         page: pageNumber,
         pageSize: pageSizeNumber,
         total,
         totalPages,
      });
      // return res.json({ items, page, pageSize, total, totalPages });

   } catch (error) {
      console.error("Error fetching products:", error);
      return res.status(500).json({ message: "Failed to fetch products" });
   }
};

// Fetch a single product by various possible IDs from DiscountMate_DB.products with latest pricing
const getProduct = async (req, res) => {
   try {
      const db = getDb(); // uses the Mongo connection created during startServer()
      const productsCol = db.collection("products");
      const pricingsCol = db.collection("product_pricings");

      // Support id coming from params, query, or body
      const identifier =
         req.params?.id ??
         req.query?.productId ??
         req.query?.product_id ??
         req.body?.productId ??
         req.body?.product_id;

      if (!identifier) {
         return res.status(400).json({ message: "Product identifier is required" });
      }

      const idStr = String(identifier).trim();
      let product = null;

      // 1) Try Mongo _id
      if (ObjectId.isValid(idStr) && /^[0-9a-fA-F]{24}$/.test(idStr)) {
         product = await productsCol.findOne({ _id: new ObjectId(idStr) });
      }

      // 2) Try product_id (e.g. "P001") exact match
      if (!product) {
         product = await productsCol.findOne({ product_id: idStr });
      }

      // 3) Try product_code as string match
      if (!product) {
         product = await productsCol.findOne({ product_code: idStr });
      }

      // 4) Try product_code as numeric match
      if (!product) {
         const numId = Number(idStr);
         if (!Number.isNaN(numId)) {
            product = await productsCol.findOne({ product_code: numId });
         }
      }

      if (!product) {
         return res.status(404).json({ message: "Product not found" });
      }

      // Latest pricing: match by product_code (consistent with getProducts $lookup)
      const code = product.product_code;

      const pricing = await pricingsCol
         .find({ product_code: code })
         .sort({ date: -1, created_at: -1 })
         .limit(1)
         .next();

      const normalised = normaliseColesProduct(product, pricing || null);
      return res.json(normalised);
   } catch (error) {
      console.error("Error fetching product:", error);
      return res.status(500).json({ message: "Internal Server Error" });
   }
};

module.exports = { getProducts, getProduct };
