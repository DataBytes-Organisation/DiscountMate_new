// userValidationRules.js
const { check, validationResult } = require("express-validator");

const userValidationRules = [
  check("useremail").isEmail().withMessage("Invalid email address"),
  check("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  check("user_fname").notEmpty().withMessage("First name is required"),
  check("user_lname").notEmpty().withMessage("Last name is required"),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

module.exports = { userValidationRules, validate };
