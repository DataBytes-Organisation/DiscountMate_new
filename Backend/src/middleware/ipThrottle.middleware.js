const rateLimit = require('express-rate-limit');
const { logSecurityEvent } = require('../utils/securityLogger'); // security log helper


const ipThrottle = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 50, // 50 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
  },
  handler: (req, res, next, options) => {
    console.warn(`[IP THROTTLE] Blocked IP ${req.ip} on ${req.originalUrl}`);
    return res.status(options.statusCode).json(options.message);
  },
});

module.exports = ipThrottle;