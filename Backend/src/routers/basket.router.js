const express = require('express');
const basketController = require('../controllers/basket.controller');

const verifyToken = require('../middleware/auth.middleware'); // NEW: Import JWT middleware to protect basket routes
const router = express.Router();

/**
 * @swagger
 * /baskets/getbasket:
 *   post:
 *     tags: [Basket]
 *     summary: Get user's basket
 *     description: Fetch all items in a user's basket. Requires JWT authentication.
 *     responses:
 *       200:
 *         description: Basket retrieved successfully.
 *       401:
 *         description: Unauthorized. Token missing or invalid.
 */
router.post('/getbasket',verifyToken ,basketController.getBasket);  // NEW: enforce authentication before accessing basket

/**
 * @swagger
 * /baskets/addtobasket:
 *   post:
 *     tags: [Basket]
 *     summary: Add an item to the basket
 *     description: Adds a product to the user's basket.
 *     responses:
 *       201:
 *         description: Item added to basket successfully.
 *       400:
 *         description: Bad request. Missing or invalid data.
 *       401:
 *         description: Unauthorized. Token missing or invalid.
 */
router.post('/addtobasket',verifyToken, basketController.addToBasket); //NEW: enforce authentication

/**
 * @swagger
 * /baskets/updatequantity:
 *   post:
 *     tags: [Basket]
 *     summary: Update item quantity
 *     description: Updates the quantity of a product in the user's basket.
 *     responses:
 *       200:
 *         description: Quantity updated successfully.
 *       400:
 *         description: Bad request. Invalid quantity.
 *       401:
 *         description: Unauthorized. Token missing or invalid.
 */
router.post('/updatequantity',verifyToken, basketController.updateQuantity); //NEW: enforce authentication

/**
 * @swagger
 * /baskets/deleteitemfrombasket:
 *   delete:
 *     tags: [Basket]
 *     summary: Delete an item from the basket
 *     description: Removes a product from the user's basket.
 *     responses:
 *       200:
 *         description: Item deleted from basket successfully.
 *       404:
 *         description: Product not found in the basket.
 *       401:
 *         description: Unauthorized. Token missing or invalid.
 */
router.delete('/deleteitemfrombasket',verifyToken, basketController.deleteFromBasket); //NEW: enforce authentication

module.exports = router;
