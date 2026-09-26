const test = require('node:test');
const assert = require('node:assert/strict');

const { GoogleAuthError } = require('../src/services/google-auth.service');
const { createGoogleAuthHandler } = require('../src/controllers/google-auth.controller');

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
}

test('Google endpoint exchanges only the ID token for a DiscountMate session', async () => {
    const user = { _id: 'user-1', email: 'person@gmail.com', role: 'user' };
    const users = { collectionName: 'users' };
    const handler = createGoogleAuthHandler({
        verifyGoogleIdentity: async (idToken) => {
            assert.equal(idToken, 'signed-google-token');
            return { subject: 'subject-1', email: 'person@gmail.com' };
        },
        connectToMongoDB: async () => ({
            collection(name) {
                assert.equal(name, 'users');
                return users;
            },
        }),
        resolveGoogleUser: async (receivedUsers, identity) => {
            assert.equal(receivedUsers, users);
            assert.deepEqual(identity, { subject: 'subject-1', email: 'person@gmail.com' });
            return user;
        },
        createDiscountMateSession: (receivedUser) => {
            assert.equal(receivedUser, user);
            return {
                message: 'Signin successful',
                token: 'discountmate-jwt',
                role: 'user',
                admin: false,
            };
        },
    });
    const response = createResponse();

    await handler({ body: { idToken: 'signed-google-token' } }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
        message: 'Signin successful',
        token: 'discountmate-jwt',
        role: 'user',
        admin: false,
    });
});

test('Google endpoint rejects a missing or oversized credential before verification', async () => {
    const handler = createGoogleAuthHandler({
        verifyGoogleIdentity: async () => {
            throw new Error('verification should not run');
        },
    });

    for (const body of [{}, { idToken: 'x'.repeat(20_001) }]) {
        const response = createResponse();
        await handler({ body }, response);
        assert.equal(response.statusCode, 400);
        assert.deepEqual(response.body, {
            message: 'A valid Google ID token is required',
            code: 'invalid_request',
        });
    }
});

test('Google endpoint preserves safe authentication error codes', async () => {
    const handler = createGoogleAuthHandler({
        verifyGoogleIdentity: async () => {
            throw new GoogleAuthError(
                409,
                'google_identity_conflict',
                'This DiscountMate account is linked to another Google identity'
            );
        },
    });
    const response = createResponse();

    await handler({ body: { idToken: 'signed-google-token' } }, response);

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.body, {
        message: 'This DiscountMate account is linked to another Google identity',
        code: 'google_identity_conflict',
    });
});

test('Google endpoint converts unexpected persistence failures into temporary unavailability', async () => {
    const logs = [];
    const handler = createGoogleAuthHandler({
        verifyGoogleIdentity: async () => ({ subject: 'subject-1', email: 'person@gmail.com' }),
        connectToMongoDB: async () => { throw new Error('database offline'); },
        logger: { error: (...args) => logs.push(args) },
    });
    const response = createResponse();

    await handler({ body: { idToken: 'signed-google-token' } }, response);

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, {
        message: 'Google sign-in is temporarily unavailable',
        code: 'authentication_unavailable',
    });
    assert.equal(JSON.stringify(logs).includes('signed-google-token'), false);
});
