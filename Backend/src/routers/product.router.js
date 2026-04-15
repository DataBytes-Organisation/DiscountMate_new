const express = require('express');
const { getProducts, getProduct } = require("../controllers/product.controller");
const ipThrottle = require('../middleware/ipThrottle.middleware'); // NEW
const { scraperSlowDown, suspiciousTrafficLogger } = require('../middleware/antiScraping.middleware'); // NEW

const router = express.Router();

/**
 * @swagger
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: Get all products
 *     description: Retrieve a list of all products.
 *     responses:
 *       200:
 *         description: Products retrieved successfully.
 *       429: 
 *         description: Too many requests. // NEW
 */
router.get(
  '/',
  suspiciousTrafficLogger, // NEW
  scraperSlowDown, // NEW
  ipThrottle, // NEW
  getProducts
);

/**
 * @swagger
 * /products/{id}: // NEW
 *   get: // NEW
 *     tags: [Products]
 *     summary: Get product details
 *     description: Fetch details of a specific product by ID.
 *     parameters: // NEW
 *       - in: path // NEW
 *         name: id // NEW
 *         required: true // NEW
 *         schema: // NEW
 *           type: string // NEW
 *         description: Product ID // NEW
 *     responses:
 *       200:
 *         description: Product retrieved successfully. // NEW
 *       429:
 *         description: Too many requests. // NEW
 */
router.get(
  '/:id',
  suspiciousTrafficLogger, // NEW
  scraperSlowDown, // NEW
  ipThrottle, // NEW
  getProduct
);

module.exports = router;
