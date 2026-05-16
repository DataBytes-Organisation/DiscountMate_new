---
title: "Scraper Protection and Monitoring"
sidebar_label: "Scraper Protection"
---

# Scraper Protection and Monitoring

Scraper protection and abnormal traffic monitoring were added to detect suspicious request behaviour.

## Purpose

The purpose of this work was to give the backend a way to identify requests that look automated or unusual.

This is important for DiscountMate because the platform handles grocery product and pricing data, which may attract scraping attempts.

## Scraper Protection

Scraper protection checks request details such as headers and user agents.

A user agent identifies what type of client is making the request, such as a browser, script, or command-line tool.

Suspicious user agents may include:

```txt
curl
wget
python-requests
scrapy
aiohttp
```

If a request uses a suspicious user agent or has missing/odd headers, it can be flagged as possible scraping behaviour.

## Example File

```txt
Backend/src/middleware/scraperProtection.middleware.js
```

## Example Scraper Protection Middleware

```js
const securityLogger = require('../utils/securityLogger');

const scraperProtection = (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const acceptHeader = req.headers['accept'];

  const suspiciousAgents = [
    'curl',
    'wget',
    'python-requests',
    'scrapy',
    'aiohttp'
  ];

  const isSuspiciousAgent = suspiciousAgents.some((agent) =>
    userAgent.toLowerCase().includes(agent)
  );

  if (isSuspiciousAgent || !acceptHeader) {
    securityLogger({
      type: 'Suspicious scraper behaviour',
      ip: req.ip,
      path: req.originalUrl,
      method: req.method,
      userAgent,
      reason: isSuspiciousAgent
        ? 'Suspicious user agent'
        : 'Missing Accept header'
    });
  }

  next();
};

module.exports = scraperProtection;
```

## Example Server Usage

```js
const scraperProtection = require('./middleware/scraperProtection.middleware');

app.use(scraperProtection);
```

## Abnormal Traffic Monitoring

Abnormal traffic monitoring logs suspicious activity so it can be reviewed later.

The logged information may include:

- IP address
- request path
- request method
- user agent
- timestamp
- reason the request was flagged

## Example File

```txt
Backend/src/utils/securityLogger.js
```

## Example Security Logger

```js
const securityLogger = (event) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: event.type,
    ip: event.ip,
    path: event.path,
    method: event.method,
    userAgent: event.userAgent,
    reason: event.reason
  };

  console.warn('[SECURITY EVENT]', JSON.stringify(logEntry));
};

module.exports = securityLogger;
```

## What Was Completed

- Checked for scraper-like user agents.
- Flagged suspicious or automated-looking requests.
- Logged suspicious request details.
- Created a foundation for future monitoring or alerting.

## Why This Matters

DiscountMate handles product and pricing data, so product and analytics endpoints may be targeted by scraping tools.

Scraper protection and monitoring help future developers identify automated access patterns that may need to be blocked, slowed, or reviewed.

## Future Improvements

Future developers should continue improving this area by:

- logging suspicious events to a file or monitoring service
- adding alerting for repeated suspicious activity
- reviewing suspicious IPs and user agents
- combining scraper signals with rate limiting
- checking whether some suspicious requests should be blocked instead of only logged

## Summary

Scraper protection and monitoring improve visibility over unusual backend traffic.

This work does not fully stop scraping by itself, but it helps the team detect and review suspicious request patterns.
