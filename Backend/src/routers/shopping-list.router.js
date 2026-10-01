const express = require('express');

const shoppingListController = require('../controllers/shopping-list.controller');
const verifyToken = require('../middleware/auth.middleware');

const router = express.Router();

// CS-13-T3: Shopping lists are user-specific and require authentication.
router.use(verifyToken);

router.get('/', shoppingListController.getShoppingLists);

router.post('/', shoppingListController.createShoppingList);

router.post('/:id/reprice', shoppingListController.repriceShoppingList);

router.put('/:id', shoppingListController.updateShoppingList);

router.delete('/:id', shoppingListController.deleteShoppingList);

router.put('/:id/active', shoppingListController.setActiveShoppingList);

module.exports = router;