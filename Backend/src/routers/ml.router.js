const express = require('express');
const mlController = require('../controllers/ml.controller');

const router = express.Router();

/**
 * @swagger
 * /ml/weekly-specials:
 *   get:
 *     tags: [ML/AI]
 *     summary: Get this week's top specials
 *     description: Retrieve weekly specials using ML/AI models
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 4
 *         description: Number of specials to return
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: Weekly specials retrieved successfully
 *       503:
 *         description: ML service unavailable
 */
router.get('/weekly-specials', mlController.getWeeklySpecials);

/**
 * @swagger
 * /ml/recommendations:
 *   post:
 *     tags: [ML/AI]
 *     summary: Get product recommendations
 *     description: Get personalized product recommendations using ML models
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: string
 *               product_id:
 *                 type: string
 *               limit:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Recommendations retrieved successfully
 */
router.post('/recommendations', mlController.getRecommendations);

/**
 * @swagger
 * /ml/price-prediction:
 *   post:
 *     tags: [ML/AI]
 *     summary: Predict future prices
 *     description: Get price predictions using ML models
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               product_id:
 *                 type: string
 *               days_ahead:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Price prediction retrieved successfully
 */
router.post('/price-prediction', mlController.getPricePrediction);

module.exports = router;

