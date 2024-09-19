// validationRules.js
const { check, validationResult } = require("express-validator");

// Validation rules for contact form
const contactValidationRules = [
  check("name").notEmpty().withMessage("Name is required"),
  check("email").isEmail().withMessage("Valid email is required"),
  check("message").notEmpty().withMessage("Message is required"),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

module.exports = { contactValidationRules, validate };
