const express = require('express');
const { handleContactFormSubmission } = require('../controllers/contact.controller');

const router = express.Router();

// Contact Form route
/**
 * @swagger
 * /contact:
 *   post:
 *     tags: [ContactForm]
 *     summary: Submit contact form
 *     description: Handles the submission of the contact form.
 */
router.post('/', handleContactFormSubmission);

module.exports = router;
