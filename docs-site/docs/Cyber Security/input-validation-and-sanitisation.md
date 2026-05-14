---
title: "Input Validation and Sanitisation"
sidebar_label: "Input Validation"
---

# Input Validation and Sanitisation

Input validation and sanitisation were added to make sure incoming user data is checked and cleaned before the backend processes it.

## Purpose

The purpose of this work was to reduce unsafe or incorrect data being accepted by the backend.

This is important because user input can come from forms, API requests, query parameters, or other frontend actions. If this data is not checked properly, it may cause errors or create security risks.

## Input Validation

Input validation checks that incoming request data is correct before it reaches the controller.

For example, validation can check that:

- required fields are not missing
- email addresses are in the correct format
- passwords meet minimum strength requirements
- numeric values are actually numbers
- empty values are rejected where needed

## Example File

```txt
Backend/src/middleware/validate.middleware.js
```

## Example Validation Middleware

```js
const validateSignup = (req, res, next) => {
  const { email, password, username } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({
      message: 'Email, password, and username are required'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return res.status(400).json({
      message: 'Invalid email format'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters long'
    });
  }

  next();
};

module.exports = {
  validateSignup
};
```

## Input Sanitisation

Input sanitisation cleans user-controlled values before they are processed or stored.

Validation checks whether input is acceptable. Sanitisation helps clean the input to make it safer.

For example, sanitisation can remove unnecessary spaces or unsafe characters from submitted text.

## Example File

```txt
Backend/src/middleware/sanitize.middleware.js
```

## Example Sanitisation Middleware

```js
const sanitizeInput = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    return value
      .trim()
      .replace(/[<>]/g, '');
  };

  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeValue(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) {
    sanitizeObject(req.body);
  }

  if (req.query) {
    sanitizeObject(req.query);
  }

  next();
};

module.exports = sanitizeInput;
```

## Example Router Usage

```js
const sanitizeInput = require('../middleware/sanitize.middleware');
const { validateSignup } = require('../middleware/validate.middleware');

router.post('/signup', sanitizeInput, validateSignup, userController.signup);
```

## What Was Completed

- Added validation checks for request body fields.
- Rejected missing, invalid, or incorrectly formatted input.
- Sanitised incoming request data.
- Reduced the risk of unsafe input reaching controller or database logic.

## Why This Matters

Input validation and sanitisation reduce the risk of broken requests, unsafe data, backend errors, and injection-style attacks.

This also improves backend reliability because invalid requests can be rejected earlier with clearer error messages.

## Future Improvements

Future developers should continue improving this area by:

- applying validation consistently across all routes
- using schema-based validation where possible
- checking query parameters as well as request bodies
- reviewing product, analytics, user, and basket endpoints
- adding stronger validation for IDs, prices, quantities, and search inputs

## Summary

Input validation and sanitisation add an important safety layer to the DiscountMate backend.

Validation blocks incorrect data, while sanitisation cleans accepted input before it continues through the backend.
