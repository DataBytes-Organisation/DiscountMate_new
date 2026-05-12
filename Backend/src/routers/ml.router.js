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

/* ============================================================
 * Recipe RAG routes (Step 2)
 * ============================================================
 * Mounted under /api/ml (see server.js line ~154), so the
 * publicly-callable URLs are:
 *   GET  /api/ml/recipe/stats
 *   GET  /api/ml/recipe/search?q=chicken&top_k=5
 *   POST /api/ml/recipe/chat
 *   POST /api/ml/recipe/reset
 *
 * Layman: This file is the "switchboard" — it tells Express
 *         which controller function to call when a particular
 *         URL is hit. Adding a route here makes that URL exist.
 */

/**
 * @swagger
 * /ml/recipe/stats:
 *   get:
 *     tags: [ML/AI - Recipe RAG]
 *     summary: Get recipe RAG diagnostics
 *     description: Returns whether the RAG pipeline is loaded, how many recipes are indexed, and how many active chat sessions exist
 *     responses:
 *       200:
 *         description: Stats retrieved successfully
 *       503:
 *         description: ML service or RAG pipeline unavailable
 */
router.get('/recipe/stats', mlController.getRecipeStats);

/**
 * @swagger
 * /ml/recipe/search:
 *   get:
 *     tags: [ML/AI - Recipe RAG]
 *     summary: Search recipes (retrieval only, no LLM)
 *     description: Returns top-k recipes by cosine similarity to the query. Fast and free — no LLM call.
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Search query
 *       - in: query
 *         name: top_k
 *         schema: { type: integer, default: 5 }
 *         description: Number of recipes to return
 *     responses:
 *       200:
 *         description: Search results returned
 *       400:
 *         description: Missing query parameter
 *       503:
 *         description: ML service unavailable
 */
router.get('/recipe/search', mlController.getRecipeSearch);

/**
 * @swagger
 * /ml/recipe/chat:
 *   post:
 *     tags: [ML/AI - Recipe RAG]
 *     summary: Send a chat message to the recipe RAG
 *     description: Full RAG pipeline — embeds query, retrieves recipes, calls LLM cascade, returns generated answer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [session_id, message]
 *             properties:
 *               session_id: { type: string, description: "Client-generated UUID identifying the conversation" }
 *               message:    { type: string, description: "User's chat message" }
 *               top_k:      { type: integer, default: 5, description: "How many recipes to retrieve" }
 *     responses:
 *       200:
 *         description: Generated answer with sources
 *       400:
 *         description: Missing session_id or message
 *       503:
 *         description: ML service unavailable
 *       504:
 *         description: LLM providers timed out
 */
router.post('/recipe/chat', mlController.postRecipeChat);

/**
 * @swagger
 * /ml/recipe/reset:
 *   post:
 *     tags: [ML/AI - Recipe RAG]
 *     summary: Reset a chat session
 *     description: Clears the conversation history for the given session_id, freeing memory and resetting the turn counter to zero
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [session_id]
 *             properties:
 *               session_id: { type: string }
 *     responses:
 *       200:
 *         description: Session reset successfully
 */
router.post('/recipe/reset', mlController.postRecipeReset);

module.exports = router;

