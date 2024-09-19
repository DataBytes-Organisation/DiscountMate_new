const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contactController");
const {
  contactValidationRules,
  validate,
} = require("../middlewares/contactValidationRules");

// Contact form submission route (No DB)
router.post(
  "/submit",
  contactValidationRules,
  validate,
  contactController.submitContactForm
);

module.exports = router;
