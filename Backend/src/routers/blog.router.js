const express = require('express');
const { getAllBlogs,submitBlog } = require('../controllers/blog.controller');

const router = express.Router();

// Get all blogs route
router.get('/', getAllBlogs);
router.post('/submit-blog', submitBlog);

module.exports = router;
