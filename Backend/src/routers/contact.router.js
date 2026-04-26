const express = require('express');
const multer = require('multer');
const { handleContactFormSubmission } = require('../controllers/contact.controller');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Only PNG, JPG, and PDF files up to 10 MB are supported.'));
        }

        cb(null, true);
    },
});

function uploadAttachment(req, res, next) {
    upload.single('attachment')(req, res, (error) => {
        if (error) {
            return res.status(400).json({ message: error.message });
        }

        next();
    });
}

// Contact Form route
/**
 * @swagger
 * /contact:
 *   post:
 *     tags: [ContactForm]
 *     summary: Submit contact form
 *     description: Handles the submission of the contact form.
 */
router.post('/', uploadAttachment, handleContactFormSubmission);

module.exports = router;
