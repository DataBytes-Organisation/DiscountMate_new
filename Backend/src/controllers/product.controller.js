const { ObjectId } = require('mongodb');
const { getDb } = require("../config/database");

const COLES_STORE_CHAINS = ['coles_generic'];
const WOOLWORTHS_STORE_CHAINS = ['woolworths_generic'];

function escapeRegex(input) {
   return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPositiveNumber(value) {
  if (value === undefined || value === null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (typeof n !== 'number' || isNaN(n) || n <= 0) return null;
  return n;
}

function pickValidPrice(pricing) {
  return toPositiveNumber(pricing?.price);
}

/**
 * product_code can be stored as number in products and string in product_pricings (or vice versa).
 */
function productCodeMatchVariantsForLookup() {
  return {
    $eq: [
      { $toString: { $ifNull: ['$product_code', ''] } },
      { $toString: { $ifNull: ['$$code', ''] } },
    ],
  };
}

/**
 * Latest pricing row per product + store_chain: price &gt; 0, then newest `date`
 * (coerced to BSON date), then `created_at`. Rows with `product_id` must match
 * the parent product `_id` (`$$pid`); rows without `product_id` still match by code (legacy).
 */
function latestPricingSubpipeline(storeChains) {
  const epoch = new Date(0);
  return [
    {
      $match: {
        $expr: {
          $and: [
            productCodeMatchVariantsForLookup(),
            { $in: ['$store_chain', storeChains] },
            {
              $or: [
                { $eq: [{ $ifNull: ['$product_id', null] }, null] },
                { $eq: ['$product_id', '$$pid'] },
              ],
            },
          ],
        },
      },
    },
    {
      $match: {
        $expr: {
          $gt: [
            { $convert: { input: '$price', to: 'double', onError: 0, onNull: 0 } },
            0,
          ],
        },
      },
    },
    {
      $addFields: {
        __priceDate: {
          $ifNull: [
            { $convert: { input: '$date', to: 'date', onError: null, onNull: null } },
            epoch,
          ],
        },
        __createdDate: {
          $ifNull: [
            { $convert: { input: '$created_at', to: 'date', onError: null, onNull: null } },
            epoch,
          ],
        },
      },
    },
    { $sort: { __priceDate: -1, __createdDate: -1 } },
    { $limit: 1 },
    { $project: { __priceDate: 0, __createdDate: 0 } },
  ];
}

function productCodeQueryVariants(code) {
  if (code === undefined || code === null) return [];
  const variants = [code];
  const asString = String(code);
  if (!variants.includes(asString)) variants.push(asString);
  const asNum = Number(code);
  if (!Number.isNaN(asNum) && !variants.includes(asNum)) variants.push(asNum);
  return variants;
}

function pricingRowSortTime(doc) {
  const tryMs = (v) => {
    if (v == null) return null;
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
  };
  return tryMs(doc?.date) ?? tryMs(doc?.created_at) ?? 0;
}

/**
 * Same semantics as $lookup subpipeline (product_id scope when provided, then newest `date`).
 */
async function fetchLatestPricingForStoreChains(
  pricingsCol,
  productCode,
  storeChains,
  productMongoId = null
) {
  const codes = productCodeQueryVariants(productCode);
  if (codes.length === 0) return null;

  const filter = { product_code: { $in: codes }, store_chain: { $in: storeChains } };
  if (productMongoId != null) {
    filter.$or = [
      { product_id: productMongoId },
      { product_id: { $exists: false } },
      { product_id: null },
    ];
  }

  const docs = await pricingsCol.find(filter).limit(250).toArray();

  const priced = docs.filter((d) => pickValidPrice(d));
  if (priced.length === 0) return null;

  priced.sort((a, b) => pricingRowSortTime(b) - pricingRowSortTime(a));
  return priced[0];
}

/**
 * @param {object} product - document from products collection
 * @param {{ coles?: object | null, woolworths?: object | null }} pricings - latest product_pricings per store_chain
 */
function normaliseColesProduct(product, pricings = {}) {
  if (!product) return null;

  const colesPricing = pricings.coles ?? null;
  const woolworthsPricing = pricings.woolworths ?? null;

  const colesPrice = pickValidPrice(colesPricing);
  const woolworthsPrice = pickValidPrice(woolworthsPricing);

  // Prefer Coles for legacy single-field consumers; otherwise Woolworths; else 0
  const currentPrice =
    colesPrice != null ? colesPrice : woolworthsPrice != null ? woolworthsPrice : 0;

  const primaryPricing = colesPricing || woolworthsPricing;

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

    // Price used throughout the UI (primary / legacy)
    current_price: currentPrice,

    // Per-retailer prices (null when missing or invalid — frontend shows "-")
    coles_price: colesPrice,
    woolworths_price: woolworthsPrice,

    // Latest pricing metadata (exists in product_pricings collection)
    store_chain: primaryPricing?.store_chain ?? null,
    price_date: primaryPricing?.date ?? null,
    best_price: primaryPricing?.best_price ?? null,
    unit_price: colesPricing?.unit_price ?? woolworthsPricing?.unit_price ?? null,
    coles_unit_price: colesPricing?.unit_price ?? null,
    woolworths_unit_price: woolworthsPricing?.unit_price ?? null,
    best_unit_price: primaryPricing?.best_unit_price ?? null,
    is_on_special: primaryPricing?.is_on_special ?? null,

    // Timestamps
    created_at: product.created_at ?? null,
    updated_at: product.updated_at ?? null,
    pricing_created_at: primaryPricing?.created_at ?? null,
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

      const sortNameStage = {
         $addFields: {
            sortName: {
               $toLower: {
                  $ifNull: [
                     '$product_name',
                     { $ifNull: ['$name', { $ifNull: ['$item_name', ''] }] },
                  ],
               },
            },
         },
      };

      const pricingLookupStages = [
         {
            $lookup: {
               from: 'product_pricings',
               let: { code: '$product_code', pid: '$_id' },
               pipeline: latestPricingSubpipeline(COLES_STORE_CHAINS),
               as: 'latestColesPricingArr',
            },
         },
         {
            $lookup: {
               from: 'product_pricings',
               let: { code: '$product_code', pid: '$_id' },
               pipeline: latestPricingSubpipeline(WOOLWORTHS_STORE_CHAINS),
               as: 'latestWoolworthsPricingArr',
            },
         },
         {
            $addFields: {
               latestColesPricing: { $arrayElemAt: ['$latestColesPricingArr', 0] },
               latestWoolworthsPricing: { $arrayElemAt: ['$latestWoolworthsPricingArr', 0] },
            },
         },
      ];

      const projectPricingStage = {
         $project: {
            latestColesPricingArr: 0,
            latestWoolworthsPricingArr: 0,
            sortName: 0,
         },
      };

      /**
       * $skip/$limit before pricing lookups so each request runs 2× lookups on at most
       * `pageSizeNumber` docs (not the whole products collection), avoiding Atlas time limits.
       * Pages may include products with no Coles/Woolworths price; the frontend handles that.
       */
      const basePipeline = [
         { $match: match },

         ...categoryNameStages,

         sortNameStage,

         { $sort: { sortName: 1, _id: 1 } },

         { $skip: (pageNumber - 1) * pageSizeNumber },
         { $limit: pageSizeNumber },

         ...pricingLookupStages,

         projectPricingStage,
      ];

      /** Count products matching filters only (no product_pricings join — keeps this query fast). */
      const countPipeline = [
         { $match: match },
         ...categoryNameStages,
         { $count: 'total' },
      ];

      const [items, totalArr] = await Promise.all([
         coles.aggregate(basePipeline, { allowDiskUse: true }).toArray(),
         coles.aggregate(countPipeline, { allowDiskUse: true }).toArray(),
      ]);

      const total = totalArr?.[0]?.total || 0;
      const totalPages = total === 0 ? 0 : Math.ceil(total / pageSizeNumber);

      const normalised = items
         .map((p) =>
            normaliseColesProduct(p, {
               coles: p.latestColesPricing || null,
               woolworths: p.latestWoolworthsPricing || null,
            })
         )
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

      const [colesPricing, woolworthsPricing] = await Promise.all([
         fetchLatestPricingForStoreChains(pricingsCol, code, COLES_STORE_CHAINS, product._id),
         fetchLatestPricingForStoreChains(pricingsCol, code, WOOLWORTHS_STORE_CHAINS, product._id),
      ]);

      const normalised = normaliseColesProduct(product, {
         coles: colesPricing || null,
         woolworths: woolworthsPricing || null,
      });
      return res.json(normalised);
   } catch (error) {
      console.error("Error fetching product:", error);
      return res.status(500).json({ message: "Internal Server Error" });
   }
};

module.exports = { getProducts, getProduct };
