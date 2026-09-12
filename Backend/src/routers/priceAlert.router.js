const express = require('express');
const priceAlertController = require('../controllers/priceAlert.controller');

const router = express.Router();

router.post('/events', priceAlertController.receivePriceEvents);

router.get('/', priceAlertController.getPriceAlerts);
router.post('/', priceAlertController.createPriceAlert);
router.put('/:id', priceAlertController.updatePriceAlert);
router.patch('/:id/status', priceAlertController.updatePriceAlertStatus);
router.delete('/:id', priceAlertController.deletePriceAlert);
router.get('/:id/deliveries', priceAlertController.getPriceAlertDeliveries);

module.exports = router;
