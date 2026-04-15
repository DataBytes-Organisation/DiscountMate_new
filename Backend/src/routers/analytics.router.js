const express = require('express');
const analyticsController = require('../controllers/analytics.controller');
const ipThrottle = require('../middleware/ipThrottle.middleware'); // NEW
const { scraperSlowDown, suspiciousTrafficLogger } = require('../middleware/antiScraping.middleware'); // NEW

const router = express.Router();

/**
 * @swagger
 * /analytics/sales-summary:
 *   post:
 *     tags: [Analytics]
 *     summary: Get sales summary by keyword
 *     description: Analyze sales data for products matching a keyword
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               keyword:
 *                 type: string
 *                 example: "chips"
 *               store:
 *                 type: string
 *                 enum: [all, woolworths, coles]
 *                 default: all
 *     responses:
 *       200:
 *         description: Sales summary retrieved successfully
 *       429: // NEW
 *         description: Too many requests // NEW
 *       503:
 *         description: Analytics service unavailable
 */
router.post(
  '/sales-summary',
  suspiciousTrafficLogger, // NEW
  scraperSlowDown, // NEW
  ipThrottle, // NEW
  analyticsController.getSalesSummary
);

/**
 * @swagger
 * /analytics/brand-analysis:
 *   post:
 *     tags: [Analytics]
 *     summary: Get top brands by keyword
 *     description: Identify top-selling brands for products matching a keyword
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               keyword:
 *                 type: string
 *                 example: "milk"
 *               top_n:
 *                 type: integer
 *                 default: 5
 *     responses:
 *       200:
 *         description: Brand analysis retrieved successfully
 *       429: // NEW
 *         description: Too many requests // NEW
 */
router.post(
  '/brand-analysis',
  suspiciousTrafficLogger, // NEW
  scraperSlowDown, // NEW
  ipThrottle, // NEW
  analyticsController.getBrandAnalysis
);

/**
 * @swagger
 * /analytics/price-comparison:
 *   post:
 *     tags: [Analytics]
 *     summary: Compare prices across stores
 *     description: Find and compare prices for products matching a keyword
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               keyword:
 *                 type: string
 *                 example: "eggs"
 *               include_details:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Price comparison retrieved successfully
 *       429: // NEW
 *         description: Too many requests // NEW
 */
router.post(
  '/price-comparison',
  suspiciousTrafficLogger, // NEW
  scraperSlowDown, // NEW
  ipThrottle, // NEW
  analyticsController.getPriceComparison
);

/**
 * @swagger
 * /analytics/data-cleaning:
 *   post:
 *     tags: [Analytics]
 *     summary: Clean transaction data
 *     description: Clean and preprocess transaction data
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: array
 *                 items:
 *                   type: object
 *               operations:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["remove_duplicates", "handle_missing", "standardize"]
 *     responses:
 *       200:
 *         description: Data cleaned successfully
 *       429: // NEW
 *         description: Too many requests // NEW
 */
router.post(
  '/data-cleaning',
  suspiciousTrafficLogger, // NEW
  scraperSlowDown, // NEW
  ipThrottle, // NEW
  analyticsController.cleanData
);

module.exports = router;