const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

function normaliseTopK(value) {
   const parsed = Number.parseInt(value, 10);
   if (!Number.isFinite(parsed)) return 5;
   return Math.min(Math.max(parsed, 1), 10);
}

function normaliseImageUrl(imageUrl) {
   if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return imageUrl;
   }

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

      const normalisedBody = Array.isArray(body)
         ? body.map((result) => ({
            ...result,
            image_url: normaliseImageUrl(result.image_url),
         }))
         : body;

      return res.json(normalisedBody);
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
