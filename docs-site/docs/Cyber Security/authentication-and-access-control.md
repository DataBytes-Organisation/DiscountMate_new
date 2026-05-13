---
title: "Authentication and Access Control"
sidebar_label: "Authentication"
---

# Authentication and Access Control

Authentication and access control were worked on to protect sensitive DiscountMate backend routes from unauthorised users.

This work focused on making sure users must have a valid login token before accessing protected features, such as profile and basket-related routes.

---

## Purpose

The purpose of authentication is to confirm that the user is logged in and allowed to access protected backend routes.

Without authentication, users or automated requests could potentially access routes that should only be available to logged-in users.

For DiscountMate, this is important because some backend routes are linked to user accounts, saved baskets, and account-related information.

---

## How Authentication Works

The backend uses JWT authentication.

When a user signs in successfully, the backend creates a token. This token is then sent with future requests in the `Authorization` header.

Example request header:

```txt
Authorization: Bearer <token>
```

The authentication middleware checks the token before the request reaches the controller.

If the token is valid, the user details are decoded and attached to the request as:

```js
req.user
```

The controller can then use `req.user` to identify the logged-in user.

If the token is missing, invalid, or expired, the request is rejected.

---

## Example File

```txt
Backend/src/middleware/auth.middleware.js
```

---

## Example Middleware

```js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'No token provided, please log in'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired token'
    });
  }
};

module.exports = verifyToken;
```

---

## Router-Level Protection

Protected routes should use the authentication middleware before calling the controller.

This means the request is checked first. If the user is not authenticated, the controller logic will not run.

Example file:

```txt
Backend/src/routers/basket.router.js
```

Example route protection:

```js
const express = require('express');
const basketController = require('../controllers/basket.controller');
const verifyToken = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/getbasket', verifyToken, basketController.getBasket);
router.post('/addtobasket', verifyToken, basketController.addToBasket);
router.post('/updatequantity', verifyToken, basketController.updateQuantity);
router.post('/deleteitemfrombasket', verifyToken, basketController.deleteItemFromBasket);

module.exports = router;
```

---

## Access Control

Access control is about checking what an authenticated user is allowed to do.

Authentication confirms who the user is. Access control checks what permissions they have.

For example:

- normal users should only access their own basket or profile
- admin-only actions should not be available to normal users
- the backend should not trust admin values sent from the frontend
- role checks should happen on the server side

---

## Important Access Control Notes

One issue to carry forward is making sure admin or role-based access is controlled safely.

Future developers should avoid trusting values sent from the client, such as:

```js
admin: true
```

or role values that can be changed from the frontend.

Instead, the backend should check the user role from a trusted source, such as the database or a verified JWT payload created by the server.

---

## Example Files

```txt
Backend/src/middleware/auth.middleware.js
Backend/src/routers/user.router.js
Backend/src/routers/basket.router.js
Backend/src/controllers/user.controller.js
Backend/src/controllers/basket.controller.js
Backend/src/schemas/user.schema.js
```

---

## What Was Completed

- Added JWT authentication middleware.
- Checked for missing, invalid, and expired tokens.
- Attached decoded user data to `req.user`.
- Protected user-related and basket-related routes.
- Reduced repeated manual token checks inside controllers.
- Improved the structure by moving authentication checks into middleware.

---

## Why This Matters

This improves backend security because protected routes cannot be accessed without a valid token.

It also improves maintainability because authentication is handled in one central middleware file instead of being repeated across multiple controllers.

This makes the backend cleaner, easier to test, and easier for future developers to extend.

---

## Future Improvements

Future developers should continue improving access control by:

- reviewing all protected routes
- checking that sensitive routes use `verifyToken`
- adding admin-only middleware where needed
- removing any client-controlled admin logic
- making sure role checks happen server-side
- checking that users can only access their own data
- reviewing JWT claims to make sure they cannot be misused

---

## Summary

The authentication work added an important security layer to the DiscountMate backend.

JWT middleware now checks whether users are logged in before protected routes are accessed. This helps protect user-related features and reduces repeated authentication logic inside controllers.

Access control should continue to be improved next study period, especially around admin roles, trusted permissions, and preventing users from accessing data or actions they should not have access to.
