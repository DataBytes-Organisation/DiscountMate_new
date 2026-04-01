const express = require('express');
const rateLimit = require('express-rate-limit'); // NEW
const analyticsController = require('../controllers/analytics.controller');

const router = express.Router();

const analyticsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // NEW: 1 minute
  max: 20, // NEW: max 20 requests per IP
  message: {
    success: false,
    message: 'Too many analytics requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

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
 *       503:
 *         description: Analytics service unavailable
 */
router.post('/sales-summary', analyticsLimiter, analyticsController.getSalesSummary);// NEW rate limited

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
 */
router.post('/brand-analysis', analyticsLimiter, analyticsController.getBrandAnalysis);// NEW rate limited

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
 */
router.post('/price-comparison', analyticsLimiter, analyticsController.getPriceComparison); // NEW rate limited

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
 */
router.post('/data-cleaning', analyticsLimiter, analyticsController.cleanData); // NEW rate limited

module.exports = router;

