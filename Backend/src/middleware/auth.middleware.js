require('dotenv').config();
const jwt = require('jsonwebtoken');
const { logSecurityEvent } = require('../utils/securityLogger');

// new Changed the logic for extracting the token from the Authorization header to explicitly check if it starts with 'Bearer '
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1] // Extract the token part after "Bearer"
        : null; // If no token is found, set it to null

    // CS-15-T3: Log requests to protected routes without a token.
    if (!token) {
            logSecurityEvent({
                event: 'INVALID_TOKEN_USAGE',
                ip: req.ip,
                method:req.method,
                route: req.originalUrl,
                details: ['No authentication token provided'],
            });

        return res.status(401).json({message: "No token provided"});
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // CS-12: re-check the user's role against the database instead of trusting the token
        const { connectToMongoDB } = require('../config/database');
        const db = await connectToMongoDB();
        const currentUser = await db.collection('users').findOne({ email: decoded.email });

        if (!currentUser) {
            return res.status(401).json({ message: "User no longer exists" });
        }

        req.user = {
            ...decoded,
            role: currentUser.role || (currentUser.admin ? 'admin' : 'user'), // use the current database role, not the token's
        };

        next();
    } catch (err) {

        logSecurityEvent({
            event: 'INVALID_TOKEN_USAGE',
            ip: req.ip,
            method:req.method,
            route: req.originalUrl,
            details: [
                err.name === 'TokenExpiredError'
                    ? 'Expired authentication token.'
                    : 'Invalid authentication token.'
            ],
        });

        if (err.name === "TokenExpiredError") {
            return res.status(401).json({message: "Token Has Expired"});
        }

        // CS-15-T3: Log malformed or invalid authentication tokens.
        logSecurityEvent({
            event: 'AUTH_TOKEN_INVALID',
            ip: req.ip,
            method: req.method,
            route: req.originalUrl,
            details: {
                errorType: err.name,
            },
        });

        return res.status(401).json({
            message: 'Invalid Token',
        });
    }
};

module.exports = verifyToken;
