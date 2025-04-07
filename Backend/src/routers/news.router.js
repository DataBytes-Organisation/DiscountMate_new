const express = require('express');
const { getAllNews,submitNews } = require('../controllers/news.controller');

const router = express.Router();

// Get all news route

/**
 * @swagger
 * /news:
 *   get:
 *     tags: [News]
 *     summary: Get all news
 *     description: Retrieve a list of all news articles.
 *     responses:
 *       200:
 *         description: News retrieved successfully.
 */
router.get('/', getAllNews);

/**
 * @swagger
 * /news/submit-news:
 *   post:
 *     tags: [News]
 *     summary: Submit a news article
 *     description: Add a new news article.
 */
router.post('/submit-news', submitNews)

module.exports = router;
