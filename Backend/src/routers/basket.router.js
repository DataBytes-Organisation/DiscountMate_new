const express = require('express');
const basketController = require('../controllers/basket.controller');

const router = express.Router();

// Get current user's basket
router.post('/getbasket', basketController.getBasket);

// Add to basket (by product_id or product_code)
router.post('/addtobasket', basketController.addToBasket);

// Update quantity (support both old and new routes)
router.post('/updatequantity', basketController.updateQuantity);
router.put('/updatebasketquantity', basketController.updateQuantity);

// Delete an item
router.delete('/deleteitemfrombasket', basketController.deleteFromBasket);

module.exports = router;
