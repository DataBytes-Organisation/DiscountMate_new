const { param, query } = require('express-validator'); // import query and param validators

const getProductsValidation = [
  query('page') // validate page query
    .optional() // only validate if provided
    .isInt({ min: 1, max: 100 }).withMessage('Page must be between 1 and 100.') // must be integer in range
    .toInt(), // convert to integer

  query('limit') // validate limit query
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50.')
    .toInt(),

  query('keyword') // validate keyword query
    .optional()
    .isString().withMessage('Keyword must be text.')
    .trim() // remove spaces
    .escape() // sanitize special characters
    .isLength({ max: 100 }).withMessage('Keyword is too long.'),

  query('category') // validate category query
    .optional()
    .isString().withMessage('Category must be text.')
    .trim()
    .escape()
    .isLength({ max: 50 }).withMessage('Category is too long.'),
];

const getProductValidation = [
  param('id') // validate product id in URL
    .isMongoId().withMessage('Invalid product ID.'),
];

module.exports = {
  getProductsValidation,
  getProductValidation,
};