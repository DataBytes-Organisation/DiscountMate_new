const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/database');

const router = express.Router();
const upload = multer({
   storage: multer.memoryStorage(),
   limits: { fileSize: 8 * 1024 * 1024 },
});

const DEFAULT_SERVICE_URL = 'http://localhost:8001';
const DEFAULT_SCRAPED_IMAGES_DIR = path.resolve(
   __dirname,
   '../../../experimental/ReverseImageSearch/Scraped_images'
);

function getServiceUrl() {
   return (process.env.REVERSE_IMAGE_SEARCH_SERVICE_URL || DEFAULT_SERVICE_URL).replace(/\/+$/, '');
}

function getScrapedImagesDir() {
   return process.env.REVERSE_IMAGE_SEARCH_IMAGES_DIR || DEFAULT_SCRAPED_IMAGES_DIR;
}

async function fetchLatestPrice(db, productCode, storeChain) {
   if (!productCode) return null;
   const doc = await db.collection('product_pricings').findOne(
      { product_code: productCode, store_chain: storeChain },
      { sort: { created_at: -1 }, projection: { price: 1 } }
   );
   if (!doc || doc.price == null) return null;
   const p = Number.parseFloat(String(doc.price));
   return Number.isFinite(p) ? `$${p.toFixed(2)}` : null;
}

function normaliseTopK(value) {
   const parsed = Number.parseInt(value, 10);
   if (!Number.isFinite(parsed)) return 5;
   return Math.min(Math.max(parsed, 1), 10);
}

function normaliseImageUrl(imageUrl) {
   if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return imageUrl;
   }
   // Preserve full CDN URLs from MongoDB — the browser can display them directly
   if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
   }
   // Legacy local path (Coles scraper): strip to filename only
   const filename = imageUrl.split('/').pop();
   if (!filename) {
      return imageUrl;
   }
   return `/images/${encodeURIComponent(filename)}`;
}

router.get('/health', async (_req, res) => {
   try {
      const response = await fetch(`${getServiceUrl()}/health`);
      const body = await response.json().catch(() => ({}));
      return res.status(response.status).json(body);
   } catch (error) {
      return res.status(503).json({
         message: 'Reverse image search service is unavailable',
         detail: error.message,
      });
   }
});

// Proxy a CDN image URL server-side — avoids any client CORS/CDN restrictions.
// Usage: GET /images/proxy?url=https%3A%2F%2Fcdn.example.com%2Fimage.jpg
router.get('/images/proxy', async (req, res) => {
   const targetUrl = req.query.url;
   if (!targetUrl || !targetUrl.startsWith('http')) {
      return res.status(400).json({ message: 'Missing or invalid url query parameter' });
   }
   try {
      const upstream = await fetch(targetUrl, {
         headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DiscountMate/1.0)' },
      });
      if (!upstream.ok) {
         return res.status(upstream.status).json({ message: 'CDN returned an error' });
      }
      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.send(buffer);
   } catch (error) {
      return res.status(502).json({ message: 'Could not fetch image', detail: error.message });
   }
});

router.get('/images/:filename', async (req, res) => {
   const filename = path.basename(req.params.filename);
   const imagePath = path.join(getScrapedImagesDir(), filename);

   if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
         message: 'Reverse image search image not found in Scraped_images',
      });
   }

   res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
   res.setHeader('Cache-Control', 'public, max-age=3600');
   return res.sendFile(imagePath);
});

router.post('/', upload.single('file'), async (req, res) => {
   if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
   }

   if (!req.file.mimetype || !req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ message: 'Uploaded file must be an image' });
   }

   const topK = normaliseTopK(req.query.top_k);
   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), 90_000);

   try {
      const formData = new FormData();
      const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
      formData.append('file', blob, req.file.originalname || 'image.jpg');

      const response = await fetch(
         `${getServiceUrl()}/reverse-image-search?top_k=${topK}`,
         {
            method: 'POST',
            body: formData,
            signal: controller.signal,
         }
      );

      const body = await response.json().catch(async () => ({
         detail: await response.text().catch(() => ''),
      }));

      if (!response.ok) {
         return res.status(response.status).json({
            message: 'Reverse image search failed',
            detail: body.detail || body.message || body,
         });
      }

      if (!Array.isArray(body)) {
         return res.json(body);
      }

      const normalisedResults = body.map((result) => ({
         ...result,
         image_url: normaliseImageUrl(result.image_url),
      }));

      // Enrich with live pricing from product_pricings collection
      try {
         const db = getDb();
         const mongoIds = normalisedResults
            .map((r) => r.mongo_id)
            .filter(Boolean)
            .map((id) => {
               try { return new ObjectId(id); } catch { return null; }
            })
            .filter(Boolean);

         // Fetch all product documents in one query to get product_codes
         const products = mongoIds.length > 0
            ? await db.collection('products')
               .find({ _id: { $in: mongoIds } }, { projection: { _id: 1, product_code: 1 } })
               .toArray()
            : [];

         // Normalise product_code to string — MongoDB stores it as string or number
         const codeByMongoId = Object.fromEntries(
            products.map((p) => [p._id.toString(), p.product_code != null ? String(p.product_code) : null])
         );

         // product_pricings.product_code may also be string or number — match both variants
         const productCodes = [...new Set(Object.values(codeByMongoId).filter(Boolean))];
         const productCodesNumeric = productCodes.map(Number).filter(Number.isFinite);
         const allCodeVariants = [...productCodes, ...productCodesNumeric];

         const pricingPipeline = (storeChain) => allCodeVariants.length > 0
            ? db.collection('product_pricings').aggregate([
               { $match: { product_code: { $in: allCodeVariants }, store_chain: storeChain } },
               { $sort: { created_at: -1 } },
               { $group: { _id: { $toString: '$product_code' }, price: { $first: '$price' } } },
            ]).toArray()
            : Promise.resolve([]);

         const [colesPricings, woolworthsPricings, igaPricings] = await Promise.all([
            pricingPipeline('coles_generic'),
            pricingPipeline('woolworths_generic'),
            pricingPipeline('iga_generic'),
         ]);

         const formatPrice = (val) => {
            if (val == null) return null;
            const p = Number.parseFloat(String(val));
            return Number.isFinite(p) ? `$${p.toFixed(2)}` : null;
         };

         const colesMap = Object.fromEntries(colesPricings.map((r) => [r._id, formatPrice(r.price)]));
         const woolworthsMap = Object.fromEntries(woolworthsPricings.map((r) => [r._id, formatPrice(r.price)]));
         const igaMap = Object.fromEntries(igaPricings.map((r) => [r._id, formatPrice(r.price)]));

         const enriched = normalisedResults.map((result) => {
            const code = result.mongo_id ? codeByMongoId[result.mongo_id] : undefined;
            return {
               ...result,
               price_now: (code && colesMap[code]) || result.price_now || null,
               woolworths_price: (code && woolworthsMap[code]) || result.woolworths_price || null,
               iga_price: (code && igaMap[code]) || result.iga_price || null,
            };
         });

         return res.json(enriched);
      } catch (dbError) {
         // DB unavailable — return results without live prices
         return res.json(normalisedResults);
      }
   } catch (error) {
      const status = error.name === 'AbortError' ? 504 : 503;
      return res.status(status).json({
         message: 'Reverse image search service is unavailable',
         detail: error.message,
      });
   } finally {
      clearTimeout(timeout);
   }
});

module.exports = router;
