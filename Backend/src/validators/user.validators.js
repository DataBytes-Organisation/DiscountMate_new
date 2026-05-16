const { body } = require('express-validator'); // import body validator

const signupValidation = [
  body('email')
    .exists({ values: 'falsy' }).withMessage('Email is required.')
    .isEmail().withMessage('Email must be valid.')
    .normalizeEmail(),

  body('password')
    .exists({ values: 'falsy' }).withMessage('Password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),

  body('firstName')
    .optional()
    .isString().withMessage('First name must be text.')
    .trim()
    .escape()
    .isLength({ max: 50 }).withMessage('First name is too long.'),

  body('lastName')
    .optional()
    .isString().withMessage('Last name must be text.')
    .trim()
    .escape()
    .isLength({ max: 50 }).withMessage('Last name is too long.'),
];

const signinValidation = [
  body('email')
    .exists({ values: 'falsy' }).withMessage('Email is required.')
    .isEmail().withMessage('Email must be valid.')
    .normalizeEmail(),

  body('password')
    .exists({ values: 'falsy' }).withMessage('Password is required.'),
];

module.exports = {
  signupValidation,
  signinValidation,
};