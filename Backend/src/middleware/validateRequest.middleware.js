const { validationResult } = require('express-validator'); // import validation result checker

const validateRequest = (req, res, next) => { // middleware to check validation results
  const errors = validationResult(req); // get validation errors from request

  if (!errors.isEmpty()) { // if validation failed
    return res.status(400).json({
      success: false,
      message: 'Invalid request data.',
      errors: errors.array(),
    });
  }

  next(); // continue if no errors
};

module.exports = validateRequest; // export middleware