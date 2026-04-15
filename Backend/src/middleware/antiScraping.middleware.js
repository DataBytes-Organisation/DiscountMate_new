const slowDown = require('express-slow-down'); // imports request slow-down middleware

const scraperSlowDown = slowDown({ // creates slow-down protection
  windowMs: 1 * 60 * 1000, // 1 minute window
  delayAfter: 10, // first 10 requests have no delay
  delayMs: () => 500, // add 500ms delay after that
});

const suspiciousTrafficLogger = (req, res, next) => { // logs suspicious request patterns
  const signals = []; // stores suspicious indicators
  const userAgent = req.get('user-agent') || ''; // gets User-Agent header
  const acceptHeader = req.get('accept') || ''; // gets Accept header

  const scraperAgents = [ // common scraping tools
    'python-requests',
    'curl/',
    'wget/',
    'scrapy',
    'aiohttp',
  ];

  if (!userAgent) signals.push('missing-user-agent'); // flags missing User-Agent
  if (!acceptHeader) signals.push('missing-accept-header'); // flags missing Accept header

  const matchedAgent = scraperAgents.find(agent =>
    userAgent.toLowerCase().includes(agent) // checks for known scraper agent
  );

  if (matchedAgent) {
    signals.push(`suspicious-user-agent:${matchedAgent}`); // flags suspicious tool
  }

  if (req.query && Object.keys(req.query).length > 10) {
    signals.push('excessive-query-params'); // flags too many query params
  }

  if (req.query?.page && Number(req.query.page) > 50) {
    signals.push('deep-pagination'); // flags unusually high page number
  }

  if (signals.length > 0) {
    console.warn(
      `[ANTI-SCRAPING] Suspicious request from IP ${req.ip} on ${req.originalUrl} :: ${signals.join(', ')}`
    ); // logs suspicious request details
  }

  next(); // continues to next middleware
};

module.exports = { scraperSlowDown, suspiciousTrafficLogger }; // exports both middleware functions