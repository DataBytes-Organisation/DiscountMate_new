const { check, validationResult } = require("express-validator");

// Validation rules for signup
const userValidationRules = [
  check("useremail").isEmail().withMessage("Invalid email address"),
  check("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  check("user_fname").notEmpty().withMessage("First name is required"),
  check("user_lname").notEmpty().withMessage("Last name is required"),
  check("phone_number")
    .optional()
    .isNumeric()
    .withMessage("Phone number must be numeric"),
];

// Validation rules for profile update
const userUpdateValidationRules = [
  check("useremail").optional().isEmail().withMessage("Invalid email address"),
  check("password")
    .optional()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  check("user_fname")
    .optional()
    .notEmpty()
    .withMessage("First name is required"),
  check("user_lname")
    .optional()
    .notEmpty()
    .withMessage("Last name is required"),
  check("phone_number")
    .optional()
    .isNumeric()
    .withMessage("Phone number must be numeric"),
];

// Middleware to handle validation result
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

module.exports = { userValidationRules, userUpdateValidationRules, validate };
