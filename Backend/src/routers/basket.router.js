const express = require('express');
const basketController = require('../controllers/basket.controller');

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
router.post('/getbasket', basketController.getBasket);

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
router.post('/addtobasket', basketController.addToBasket);

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
router.post('/updatequantity', basketController.updateQuantity);

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
router.delete('/deleteitemfrombasket', basketController.deleteFromBasket);

module.exports = router;
