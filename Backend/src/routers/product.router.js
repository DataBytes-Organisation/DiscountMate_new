const express = require('express');
const { getProducts, getProduct } = require("../controllers/product.controller");

// NEW import rate limiter 
const rateLimit = require('express-rate-limit');

const router = express.Router();

const productLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // NEW: 1 minute window
    max: 30, // NEW max 30 requests per IP
    message: 'Too many product requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

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
 */
router.get('/', productLimiter, getProducts); // NEW apply limiter

/**
 * @swagger
 * /products/getproduct:
 *   post:
 *     tags: [Products]
 *     summary: Get product details
 *     description: Fetch details of a specific product by ID.
 */
// router.post('/getproduct', productController.getProduct);
router.get("/:id", productLimiter, getProduct); // uses req.params.id // NEW apply limiter

module.exports = router;
