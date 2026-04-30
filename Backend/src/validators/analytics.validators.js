const { body } = require('express-validator'); // import body validator

const salesSummaryValidation = [
  body('keyword') // validate keyword field
    .exists({ values: 'falsy' }).withMessage('Keyword is required.')
    .isString().withMessage('Keyword must be text.')
    .trim()
    .escape()
    .isLength({ max: 100 }).withMessage('Keyword is too long.'),

  body('store') // validate store field
    .optional()
    .isIn(['all', 'woolworths', 'coles']).withMessage('Invalid store value.'),
];

const brandAnalysisValidation = [
  body('keyword')
    .exists({ values: 'falsy' }).withMessage('Keyword is required.')
    .isString().withMessage('Keyword must be text.')
    .trim()
    .escape()
    .isLength({ max: 100 }).withMessage('Keyword is too long.'),

  body('top_n')
    .optional()
    .isInt({ min: 1, max: 20 }).withMessage('top_n must be between 1 and 20.')
    .toInt(),
];

const priceComparisonValidation = [
  body('keyword')
    .exists({ values: 'falsy' }).withMessage('Keyword is required.')
    .isString().withMessage('Keyword must be text.')
    .trim()
    .escape()
    .isLength({ max: 100 }).withMessage('Keyword is too long.'),

  body('include_details')
    .optional()
    .isBoolean().withMessage('include_details must be true or false.')
    .toBoolean(),
];

module.exports = {
  salesSummaryValidation,
  brandAnalysisValidation,
  priceComparisonValidation,
};