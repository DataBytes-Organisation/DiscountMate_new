const { check, validationResult } = require("express-validator");

// Validation rules for adding a reply
const addReplyValidationRules = [
  check("replyText")
    .notEmpty()
    .withMessage("Reply content is required")
    .isString()
    .withMessage("Reply must be a string"),
];

// Validation rules for updating a reply
const updateReplyValidationRules = [
  check("replyText")
    .notEmpty()
    .withMessage("Updated reply content is required")
    .isString()
    .withMessage("Updated reply must be a string"),
];

// Middleware to check for validation errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

module.exports = {
  addReplyValidationRules,
  updateReplyValidationRules,
  validate,
};
