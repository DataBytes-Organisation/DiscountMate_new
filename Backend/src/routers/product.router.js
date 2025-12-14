const express = require('express');
const productController = require('../controllers/product.controller');

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
 */
router.get('/', productController.getProducts);

/**
 * @swagger
 * /products/getproduct:
 *   post:
 *     tags: [Products]
 *     summary: Get product details
 *     description: Fetch details of a specific product by ID.
 */
router.post('/getproduct', productController.getProduct);

module.exports = router;
