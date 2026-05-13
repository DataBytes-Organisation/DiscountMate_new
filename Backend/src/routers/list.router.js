const express = require('express');
const listController = require('../controllers/list.controller');

const router = express.Router();

router.get('/', listController.getSavedLists);
router.post('/:id/reprice', listController.repriceSavedList);

module.exports = router;
