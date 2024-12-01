const express = require('express');
const { getAllNews,submitNews } = require('../controllers/news.controller');

const router = express.Router();

// Get all news route
router.get('/', getAllNews);
router.post('/submit-news', submitNews)

module.exports = router;
