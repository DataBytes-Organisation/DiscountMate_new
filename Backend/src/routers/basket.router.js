const express = require('express');
const basketController = require('../controllers/basket.controller');

const router = express.Router();

router.post('/getbasket', basketController.getBasket);
router.post('/addtobasket', basketController.addToBasket);
router.post('/updatequantity', basketController.updateQuantity);
router.delete('/deleteitemfrombasket', basketController.deleteFromBasket);

module.exports = router;





