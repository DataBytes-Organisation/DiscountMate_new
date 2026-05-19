const express = require('express');
const shoppingListController = require('../controllers/shopping-list.controller');

const router = express.Router();

router.get('/', shoppingListController.getShoppingLists);
router.post('/', shoppingListController.createShoppingList);
router.post('/:id/reprice', shoppingListController.repriceShoppingList);
router.put('/:id', shoppingListController.updateShoppingList);
router.delete('/:id', shoppingListController.deleteShoppingList);
router.put('/:id/active', shoppingListController.setActiveShoppingList);

module.exports = router;
