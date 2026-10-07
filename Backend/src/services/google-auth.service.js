const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const GOOGLE_ISSUERS = new Set([
    'accounts.google.com',
    'https://accounts.google.com',
]);
const TEMPORARY_NETWORK_CODES = new Set([
    'ECONNABORTED',
    'ECONNREFUSED',
    'ECONNRESET',
    'ENETUNREACH',
    'ENOTFOUND',
    'ETIMEDOUT',
    'EAI_AGAIN',
]);

class GoogleAuthError extends Error {
    constructor(statusCode, code, message) {
        super(message);
        this.name = 'GoogleAuthError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

function invalidGoogleCredential() {
    return new GoogleAuthError(
        401,
        'invalid_google_credential',
        'Google credential is invalid or expired'
    );
}

function authenticationUnavailable() {
    return new GoogleAuthError(
        503,
        'authentication_unavailable',
        'Google sign-in is temporarily unavailable'
    );
}

function parseGoogleAudienceList(value = '') {
    return [...new Set(
        String(value)
            .split(',')
            .map((audience) => audience.trim())
            .filter(Boolean)
    )];
}

function assertGoogleAuthConfiguration({
    nodeEnv = process.env.NODE_ENV,
    audiences = parseGoogleAudienceList(process.env.GOOGLE_OAUTH_CLIENT_IDS),
} = {}) {
    if (nodeEnv === 'production' && audiences.length === 0) {
        throw new Error('GOOGLE_OAUTH_CLIENT_IDS must contain at least one OAuth client ID in production');
    }
}

function isTemporaryVerificationFailure(error) {
    const status = Number(error?.response?.status || error?.status || 0);
    return TEMPORARY_NETWORK_CODES.has(error?.code) || status >= 500;
}

function normalizeVerifiedEmail(value) {
    const email = String(value || '').trim().toLowerCase();
    return /^\S+@\S+\.\S+$/.test(email) ? email : '';
}

function createGoogleIdentityVerifier({
    audiences = parseGoogleAudienceList(process.env.GOOGLE_OAUTH_CLIENT_IDS),
    oauthClient = new OAuth2Client(),
    now = () => Date.now(),
} = {}) {
    return async function verifyGoogleIdentity(idToken) {
        if (!Array.isArray(audiences) || audiences.length === 0) {
            throw authenticationUnavailable();
        }
        if (typeof idToken !== 'string' || !idToken.trim()) {
            throw invalidGoogleCredential();
        }

        let payload;
        try {
            const ticket = await oauthClient.verifyIdToken({
                idToken: idToken.trim(),
                audience: audiences,
            });
            payload = ticket?.getPayload?.();
        } catch (error) {
            if (isTemporaryVerificationFailure(error)) {
                throw authenticationUnavailable();
            }
            throw invalidGoogleCredential();
        }

        const email = normalizeVerifiedEmail(payload?.email);
        const subject = String(payload?.sub || '').trim();
        const audience = String(payload?.aud || '').trim();
        const expiresAt = Number(payload?.exp || 0) * 1000;

        if (
            !payload ||
            !GOOGLE_ISSUERS.has(payload.iss) ||
            !audiences.includes(audience) ||
            !Number.isFinite(expiresAt) ||
            expiresAt <= now() ||
            !subject ||
            !email ||
            payload.email_verified !== true
        ) {
            throw invalidGoogleCredential();
        }

        return {
            subject,
            email,
            firstName: String(payload.given_name || '').trim(),
            lastName: String(payload.family_name || '').trim(),
        };
    };
}

function googleIdentityDocument(identity, linkedAt) {
    return {
        subject: identity.subject,
        email_at_link: identity.email,
        linked_at: linkedAt,
    };
}

function googleIdentityConflict() {
    return new GoogleAuthError(
        409,
        'google_identity_conflict',
        'This DiscountMate account is linked to another Google identity'
    );
}

async function resolveGoogleUser(users, identity, { now = () => new Date() } = {}) {
    const linkedUser = await users.findOne({
        'external_identities.google.subject': identity.subject,
    });
    if (linkedUser) return linkedUser;

    const existingUser = await users.findOne({ email: identity.email });
    const linkedAt = now();

    if (existingUser) {
        const existingSubject = existingUser.external_identities?.google?.subject;
        if (existingSubject && existingSubject !== identity.subject) {
            throw googleIdentityConflict();
        }

        let updateResult;
        try {
            updateResult = await users.updateOne({
                _id: existingUser._id,
                $or: [
                    { 'external_identities.google.subject': { $exists: false } },
                    { 'external_identities.google.subject': identity.subject },
                ],
            }, {
                $set: {
                    'external_identities.google': googleIdentityDocument(identity, linkedAt),
                },
            });
        } catch (error) {
            if (error?.code !== 11000) throw error;

            const winner = await users.findOne({
                'external_identities.google.subject': identity.subject,
            });
            if (winner) return winner;
            throw googleIdentityConflict();
        }

        if (updateResult.matchedCount === 0) {
            const winner = await users.findOne({ _id: existingUser._id });
            if (winner?.external_identities?.google?.subject === identity.subject) {
                return winner;
            }
            throw googleIdentityConflict();
        }

        return users.findOne({ _id: existingUser._id });
    }

    const user = {
        account_user_name: identity.email,
        email: identity.email,
        email_verified: true,
        user_fname: identity.firstName || '',
        user_lname: identity.lastName || '',
        address: '',
        phone_number: '',
        admin: false,
        role: 'user',
        external_identities: {
            google: googleIdentityDocument(identity, linkedAt),
        },
    };

    try {
        const result = await users.insertOne(user);
        return { _id: result.insertedId, ...user };
    } catch (error) {
        if (error?.code !== 11000) throw error;

        const winner = await users.findOne({
            'external_identities.google.subject': identity.subject,
        });
        if (winner) return winner;

        const emailOwner = await users.findOne({ email: identity.email });
        if (emailOwner?.external_identities?.google?.subject === identity.subject) {
            return emailOwner;
        }
        throw googleIdentityConflict();
    }
}

async function ensureGoogleIdentityIndex(db) {
    return db.collection('users').createIndex(
        { 'external_identities.google.subject': 1 },
        {
            unique: true,
            sparse: true,
            name: 'unique_google_subject',
        }
    );
}

async function passwordMatchesUser(password, user, comparePassword) {
    if (typeof user?.encrypted_password !== 'string' || !user.encrypted_password) {
        return false;
    }
    return comparePassword(password, user.encrypted_password);
}

function createDiscountMateSession(user, {
    jwtSecret = process.env.JWT_SECRET,
    signToken = jwt.sign,
} = {}) {
    const role = user.role || (user.admin ? 'admin' : 'user');
    const admin = role === 'admin';
    const email = String(user.email || '').trim().toLowerCase();
    const token = signToken(
        { email, role, admin },
        jwtSecret,
        { expiresIn: '1h' }
    );

    return {
        message: 'Signin successful',
        token,
        role,
        admin,
    };
}

module.exports = {
    assertGoogleAuthConfiguration,
    GoogleAuthError,
    createDiscountMateSession,
    createGoogleIdentityVerifier,
    ensureGoogleIdentityIndex,
    parseGoogleAudienceList,
    passwordMatchesUser,
    resolveGoogleUser,
};
