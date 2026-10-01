const { connectToMongoDB } = require('../config/database');
const { rateLimit } = require('express-rate-limit');
const {
    GoogleAuthError,
    createDiscountMateSession,
    createGoogleIdentityVerifier,
    resolveGoogleUser,
} = require('../services/google-auth.service');

function createGoogleAuthHandler({
    verifyGoogleIdentity = createGoogleIdentityVerifier(),
    connectToMongoDB: connect = connectToMongoDB,
    resolveGoogleUser: resolveUser = resolveGoogleUser,
    createDiscountMateSession: createSession = createDiscountMateSession,
    logger = { error() {} },
} = {}) {
    return async function googleSignIn(req, res) {
        const idToken = req.body?.idToken;
        if (
            typeof idToken !== 'string' ||
            !idToken.trim() ||
            idToken.length > 20_000
        ) {
            return res.status(400).json({
                message: 'A valid Google ID token is required',
                code: 'invalid_request',
            });
        }

        try {
            const identity = await verifyGoogleIdentity(idToken);
            const db = await connect();
            const user = await resolveUser(db.collection('users'), identity);
            return res.status(200).json(createSession(user));
        } catch (error) {
            if (error instanceof GoogleAuthError) {
                return res.status(error.statusCode).json({
                    message: error.message,
                    code: error.code,
                });
            }

            logger.error('Google authentication failed unexpectedly', {
                errorName: error?.name || 'Error',
                errorCode: error?.code || null,
            });
            return res.status(503).json({
                message: 'Google sign-in is temporarily unavailable',
                code: 'authentication_unavailable',
            });
        }
    };
}

const googleSignIn = createGoogleAuthHandler({ logger: console });
// Google's own popup/consent flow already authenticates the user before this
// endpoint is ever called, so this limiter only needs to stop automated abuse
// of the token-exchange endpoint, not brute-force credential guessing. A
// 5-per-5-minute cap was tight enough that normal retries (closed popup,
// wrong Google account, flaky network, or several people testing behind the
// same NAT/IP) routinely tripped it.
const googleSigninLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({
        message: 'Too many Google sign-in attempts. Please try again later.',
        code: 'rate_limited',
    }),
});

module.exports = {
    createGoogleAuthHandler,
    googleSignIn,
    googleSigninLimiter,
};
