const express = require('express');
const { getAllBlogs,submitBlog } = require('../controllers/blog.controller');
const verifyToken = require('../middleware/auth.middleware');

const router = express.Router();

// Get all blogs route

/**
 * @swagger
 * /blogs:
 *   get:
 *     tags: [Blogs]
 *     summary: Get all blogs
 *     description: Retrieve a list of all blogs.
 *     responses:
 *       200:
 *         description: Blogs retrieved successfully.
 */
router.get('/', getAllBlogs);

/**
 * @swagger
 * /blogs/submit-blog:
 *   post:
 *     tags: [Blogs]
 *     summary: Submit a new blog
 *     description: Add a new blog post.
 *     security:
 *       - bearerAuth: []
 */
router.post('/submit-blog', verifyToken, submitBlog);

module.exports = router;
