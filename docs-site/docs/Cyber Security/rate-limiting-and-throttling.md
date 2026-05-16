---
title: "Rate Limiting and IP Throttling"
sidebar_label: "Rate Limiting"
---

# Rate Limiting and IP Throttling

Rate limiting and IP throttling were added to reduce repeated requests, scraping behaviour, brute-force attempts, and unnecessary backend load.

## Purpose

The purpose of rate limiting and throttling is to control how frequently users, bots, or automated tools can call backend endpoints.

This is useful for DiscountMate because product and analytics endpoints may be targeted by scraping tools or repeated automated requests.

## Rate Limiting

Rate limiting controls how many requests a user or IP address can make within a set time period.

If too many requests are made within the configured time window, the backend can return a `429 Too Many Requests` response.

## Example Files

```txt
Backend/src/routers/product.router.js
Backend/src/routers/analytics.router.js
```

## Example Product Rate Limiter

```js
const rateLimit = require('express-rate-limit');

const productLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    message: 'Too many product requests. Please try again later.'
  }
});
```

## Example Analytics Rate Limiter

```js
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    message: 'Too many analytics requests. Please try again later.'
  }
});
```

## Example Router Usage

```js
router.get('/products', productLimiter, productController.getProducts);
router.post('/sales-summary', analyticsLimiter, analyticsController.getSalesSummary);
router.post('/brand-analysis', analyticsLimiter, analyticsController.getBrandAnalysis);
router.post('/price-comparison', analyticsLimiter, analyticsController.getPriceComparison);
```

## IP Throttling

IP throttling slows down suspicious or repeated requests instead of immediately blocking them.

This is useful because it makes automated tools less effective while still allowing some legitimate traffic through.

Rate limiting and throttling work together:

- rate limiting blocks requests after a limit is reached
- throttling slows requests down before or around that point

## Example File

```txt
Backend/src/middleware/ipThrottle.middleware.js
```

## Example IP Throttling Middleware

```js
const slowDown = require('express-slow-down');

const ipThrottle = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 20,
  delayMs: () => 500,
  validate: {
    delayMs: false
  }
});

module.exports = ipThrottle;
```

## Example Server Usage

```js
const express = require('express');
const ipThrottle = require('./middleware/ipThrottle.middleware');

const app = express();

app.use(ipThrottle);
```

## What Was Completed

- Added rate limiting to product endpoints.
- Added rate limiting to analytics endpoints.
- Added slowdown behaviour through IP throttling middleware.
- Used rate limiting and throttling together as anti-abuse controls.

## Why This Matters

These controls help reduce brute-force login attempts, scraping, spam requests, and high-volume automated traffic.

They also help protect backend performance by reducing the impact of repeated requests.

## Future Improvements

Future developers should continue improving this area by:

- reviewing rate limits for all public endpoints
- adding stricter limits to authentication routes
- checking whether limits should be different in development and production
- logging blocked requests for future review
- tuning limits based on normal frontend behaviour

## Summary

Rate limiting and IP throttling help control request volume against the DiscountMate backend.

They do not replace authentication or input validation, but they add another layer of protection against automated abuse.
