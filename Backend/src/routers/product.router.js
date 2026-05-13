const express = require('express');
const { getProducts, getProduct } = require("../controllers/product.controller");
const ipThrottle = require('../middleware/ipThrottle.middleware');
const { scraperSlowDown, suspiciousTrafficLogger } = require('../middleware/antiScraping.middleware');
const { logSecurityEvent } = require('../utils/securityLogger');
const validateRequest = require('../middleware/validateRequest.middleware');
const { getProductsValidation, getProductValidation } = require('../validators/product.validators');

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
 *         description: Too many requests.
 */
router.get(
  '/',
  suspiciousTrafficLogger,
  scraperSlowDown,
  ipThrottle,
  getProductsValidation,
  validateRequest,
  getProducts
);
/**
 * Honeypot endpoint for bot detection
 */
router.get(
  '/export-all',
  suspiciousTrafficLogger,
  scraperSlowDown,
  ipThrottle,
  (req, res) => {
    logSecurityEvent({
      event: 'honeypot_triggered',
      ip: req.ip,
      method: req.method,
      route: req.originalUrl,
      details: ['decoy-endpoint-accessed'],
    });

    return res.status(403).json({
      success: false,
      message: 'Access denied.',
    });
  }
);

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get product details
 *     description: Fetch details of a specific product by ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product retrieved successfully.
 *       429:
 *         description: Too many requests.
 */
router.get(
  '/:id',
  suspiciousTrafficLogger,
  scraperSlowDown,
  ipThrottle,
  getProductValidation,
  validateRequest,
  getProduct
);

module.exports = router;
