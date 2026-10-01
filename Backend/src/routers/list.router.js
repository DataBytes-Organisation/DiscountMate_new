const express = require('express');

const listController = require('../controllers/list.controller');
const verifyToken = require('../middleware/auth.middleware');

const router = express.Router();

// CS-13-T3: Saved lists are user-specific and require authentication.
router.get('/', verifyToken, listController.getSavedLists);

router.post('/:id/reprice', verifyToken, listController.repriceSavedList);

module.exports = router;