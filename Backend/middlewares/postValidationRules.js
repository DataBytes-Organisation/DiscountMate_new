const { check, validationResult } = require("express-validator");

// Validation rules for creating a new post
const postValidationRules = [
  check("title").notEmpty().withMessage("Title is required"),
  check("description").notEmpty().withMessage("Description is required"),
];

// Validation rules for updating an existing post
const updatePostValidationRules = [
  check("title")
    .optional() // Title is optional for updates
    .notEmpty()
    .withMessage("Title cannot be empty"),
  check("description")
    .optional() // Description is optional for updates
    .notEmpty()
    .withMessage("Description cannot be empty"),
];

// Validation rules for comment
const commentValidationRules = [
  check("comment").notEmpty().withMessage("Comment is required"),
];

// Validation for postId in params (e.g., for like, dislike, delete, etc.)
const validatePostId = [
  check("postId").isMongoId().withMessage("Invalid post ID"),
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
  postValidationRules,
  updatePostValidationRules,
  commentValidationRules,
  validatePostId,
  validate,
};
