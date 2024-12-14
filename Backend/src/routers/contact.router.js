const express = require('express');
const { handleContactFormSubmission } = require('../controllers/contact.controller');

const router = express.Router();

// Contact Form route
router.post('/', handleContactFormSubmission);

module.exports = router;
