const {
    logSecurityEvent,
} = require('../utils/securityLogger');

// Admin-only authorization middleware
const isAdmin = (req, res, next) => {
    try {
        const effectiveRole =
            req.user?.role ||
            (req.user?.admin ? 'admin' : 'user');

        // CS-15-T3: Log denied admin access attempts.
        if (!req.user || effectiveRole !== 'admin') {
            logSecurityEvent({
                event: 'AUTHORIZATION_DENIED',
                ip: req.ip,
                method: req.method,
                route: req.originalUrl,
                details: {
                    requiredRole: 'admin',
                    currentRole: effectiveRole,
                },
            });

            return res.status(403).json({
                message: 'Access denied: Admins only',
            });
        }

        next();
    } catch (error) {
        logSecurityEvent({
            event: 'AUTHORIZATION_ERROR',
            ip: req.ip,
            method: req.method,
            route: req.originalUrl,
            details: {
                errorType: error.name,
                message: error.message,
            },
        });

        return res.status(500).json({
            message: 'Internal Server Error',
        });
    }
};

module.exports = isAdmin;