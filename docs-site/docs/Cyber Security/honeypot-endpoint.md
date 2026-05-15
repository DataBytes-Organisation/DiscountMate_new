---
title: "Honeypot Endpoint"
sidebar_label: "Honeypot"
---

# Honeypot Endpoint

A honeypot endpoint was implemented as a fake route that normal users should not access.

## Purpose

The purpose of the honeypot endpoint is to help detect automated scanning or bot activity.

A normal frontend user should not access this route. If the route is accessed, it may suggest that a bot, scanner, or automated tool is looking for hidden or sensitive endpoints.

## How It Works

A honeypot is a fake or hidden endpoint that is not meant to be used by the real frontend or normal users.

If something accesses that route, the request is logged as suspicious.

This works because automated tools often scan applications looking for common or hidden endpoints.

## Example File

```txt
Backend/src/routers/honeypot.router.js
```

## Example Honeypot Route

```js
const express = require('express');
const securityLogger = require('../utils/securityLogger');

const router = express.Router();

router.get('/admin-login-test', (req, res) => {
  securityLogger({
    type: 'Honeypot endpoint accessed',
    ip: req.ip,
    path: req.originalUrl,
    method: req.method,
    userAgent: req.headers['user-agent'],
    reason: 'Request made to fake admin route'
  });

  return res.status(404).json({
    message: 'Not found'
  });
});

module.exports = router;
```

## Example Usage in Server File

```js
const honeypotRouter = require('./routers/honeypot.router');

app.use('/api', honeypotRouter);
```

## What Was Completed

- Added a dummy endpoint for bot detection.
- Logged requests made to the honeypot route.
- Treated access to the route as suspicious behaviour.

## Why This Matters

The honeypot gives the team an extra way to detect automated scanning or bot activity.

It does not stop attacks by itself, but it helps identify suspicious behaviour early.

## Future Improvements

Future developers should continue improving this area by:

- reviewing honeypot logs regularly
- sending honeypot events to a monitoring dashboard
- adding alerting for repeated honeypot access
- ensuring the honeypot does not expose real data
- keeping the route separate from real admin functionality

## Summary

The honeypot endpoint supports bot detection by logging access to a fake route.

This gives the team another signal for identifying suspicious automated activity against the DiscountMate backend.
