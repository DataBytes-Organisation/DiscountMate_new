const { check, validationResult } = require("express-validator");

// Validation rules for adding a new comment
const addCommentValidationRules = [
  check("comment").notEmpty().withMessage("Comment text is required"),
];

// Validation rules for updating a comment
const updateCommentValidationRules = [
  check("comment").notEmpty().withMessage("Updated comment text is required"),
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
  addCommentValidationRules,
  updateCommentValidationRules,
  validate,
};
