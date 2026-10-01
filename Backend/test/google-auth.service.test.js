const test = require('node:test');
const assert = require('node:assert/strict');

const {
    assertGoogleAuthConfiguration,
    GoogleAuthError,
    createDiscountMateSession,
    createGoogleIdentityVerifier,
    ensureGoogleIdentityIndex,
    parseGoogleAudienceList,
    passwordMatchesUser,
    resolveGoogleUser,
} = require('../src/services/google-auth.service');

function createUsersCollection(seed = []) {
    const users = seed.map((user, index) => ({ _id: user._id || `user-${index + 1}`, ...user }));

    return {
        users,
        async findOne(filter) {
            if (filter['external_identities.google.subject']) {
                return users.find((user) => (
                    user.external_identities?.google?.subject === filter['external_identities.google.subject']
                )) || null;
            }
            if (filter.email) {
                return users.find((user) => user.email === filter.email) || null;
            }
            if (filter._id) {
                return users.find((user) => user._id === filter._id) || null;
            }
            return null;
        },
        async updateOne(filter, update) {
            const user = users.find((candidate) => candidate._id === filter._id);
            const googleSubject = user?.external_identities?.google?.subject;
            const canLink = user && (
                googleSubject === undefined ||
                googleSubject === filter.$or?.[1]?.['external_identities.google.subject']
            );
            if (!canLink) return { matchedCount: 0, modifiedCount: 0 };

            user.external_identities = {
                ...(user.external_identities || {}),
                google: update.$set['external_identities.google'],
            };
            return { matchedCount: 1, modifiedCount: 1 };
        },
        async insertOne(user) {
            if (users.some((candidate) => (
                candidate.external_identities?.google?.subject === user.external_identities?.google?.subject
            ))) {
                const error = new Error('duplicate google subject');
                error.code = 11000;
                throw error;
            }
            const inserted = { _id: `user-${users.length + 1}`, ...user };
            users.push(inserted);
            return { insertedId: inserted._id };
        },
    };
}

test('parseGoogleAudienceList trims and removes duplicate configured audiences', () => {
    assert.deepEqual(
        parseGoogleAudienceList(' web-id,ios-id, web-id ,,android-id '),
        ['web-id', 'ios-id', 'android-id']
    );
});

test('production startup requires at least one configured Google audience', () => {
    assert.throws(
        () => assertGoogleAuthConfiguration({ nodeEnv: 'production', audiences: [] }),
        /GOOGLE_OAUTH_CLIENT_IDS/
    );
    assert.doesNotThrow(() => assertGoogleAuthConfiguration({
        nodeEnv: 'production',
        audiences: ['web-client-id'],
    }));
    assert.doesNotThrow(() => assertGoogleAuthConfiguration({
        nodeEnv: 'test',
        audiences: [],
    }));
});

test('Google verifier accepts trusted claims returned for an allowed audience', async () => {
    const verifier = createGoogleIdentityVerifier({
        audiences: ['web-id', 'ios-id'],
        oauthClient: {
            async verifyIdToken({ idToken, audience }) {
                assert.equal(idToken, 'signed-google-token');
                assert.deepEqual(audience, ['web-id', 'ios-id']);
                return {
                    getPayload: () => ({
                        iss: 'https://accounts.google.com',
                        aud: 'ios-id',
                        exp: Math.floor(Date.now() / 1000) + 300,
                        sub: 'google-subject-1',
                        email: ' Person@Gmail.com ',
                        email_verified: true,
                        given_name: 'Pat',
                        family_name: 'Lee',
                    }),
                };
            },
        },
    });

    assert.deepEqual(await verifier('signed-google-token'), {
        subject: 'google-subject-1',
        email: 'person@gmail.com',
        firstName: 'Pat',
        lastName: 'Lee',
    });
});

for (const audience of ['web-id', 'ios-id', 'android-debug-id', 'android-release-id']) {
    test(`Google verifier accepts the configured ${audience} audience`, async () => {
        const verifier = createGoogleIdentityVerifier({
            audiences: ['web-id', 'ios-id', 'android-debug-id', 'android-release-id'],
            oauthClient: {
                verifyIdToken: async () => ({
                    getPayload: () => ({
                        iss: 'accounts.google.com',
                        aud: audience,
                        exp: Math.floor(Date.now() / 1000) + 300,
                        sub: `subject-${audience}`,
                        email: `${audience}@example.com`,
                        email_verified: true,
                    }),
                }),
            },
        });

        assert.equal((await verifier('signed-google-token')).subject, `subject-${audience}`);
    });
}

const validClaims = {
    iss: 'https://accounts.google.com',
    aud: 'web-id',
    exp: Math.floor(Date.now() / 1000) + 300,
    sub: 'subject',
    email: 'person@gmail.com',
    email_verified: true,
};

for (const [name, overrides] of [
    ['invalid issuer', { iss: 'https://example.com' }],
    ['invalid audience', { aud: 'unconfigured-id' }],
    ['expired token', { exp: Math.floor(Date.now() / 1000) - 1 }],
    ['missing subject', { sub: '' }],
    ['malformed email', { email: 'not-an-email' }],
    ['unverified email', { email_verified: false }],
]) {
    test(`Google verifier rejects ${name}`, async () => {
        const verifier = createGoogleIdentityVerifier({
            audiences: ['web-id'],
            oauthClient: {
                verifyIdToken: async () => ({
                    getPayload: () => ({ ...validClaims, ...overrides }),
                }),
            },
        });

        await assert.rejects(
            verifier('signed-google-token'),
            (error) => error instanceof GoogleAuthError &&
                error.statusCode === 401 &&
                error.code === 'invalid_google_credential'
        );
    });
}

test('Google verifier converts signature failures into a generic credential error', async () => {
    const verifier = createGoogleIdentityVerifier({
        audiences: ['web-id'],
        oauthClient: { verifyIdToken: async () => { throw new Error('bad signature details'); } },
    });

    await assert.rejects(
        verifier('signed-google-token'),
        (error) => error instanceof GoogleAuthError &&
            error.statusCode === 401 &&
            error.code === 'invalid_google_credential' &&
            !error.message.includes('signature')
    );
});

for (const [name, claims] of [
    ['missing subject', { email: 'person@gmail.com', email_verified: true }],
    ['missing email', { sub: 'subject', email_verified: true }],
    ['unverified email', { sub: 'subject', email: 'person@gmail.com', email_verified: false }],
]) {
    test(`Google verifier rejects ${name}`, async () => {
        const verifier = createGoogleIdentityVerifier({
            audiences: ['web-id'],
            oauthClient: { verifyIdToken: async () => ({ getPayload: () => claims }) },
        });

        await assert.rejects(
            verifier('signed-google-token'),
            (error) => error instanceof GoogleAuthError &&
                error.statusCode === 401 &&
                error.code === 'invalid_google_credential'
        );
    });
}

test('Google verifier maps key-service network failures to temporary unavailability', async () => {
    const networkError = Object.assign(new Error('lookup failed'), { code: 'ENOTFOUND' });
    const verifier = createGoogleIdentityVerifier({
        audiences: ['web-id'],
        oauthClient: { verifyIdToken: async () => { throw networkError; } },
    });

    await assert.rejects(
        verifier('signed-google-token'),
        (error) => error instanceof GoogleAuthError &&
            error.statusCode === 503 &&
            error.code === 'authentication_unavailable'
    );
});

test('Google sign-in links an exact normalized email without changing password account data', async () => {
    const users = createUsersCollection([{
        _id: 'existing-user',
        email: 'person@gmail.com',
        encrypted_password: 'existing-password-hash',
        user_fname: 'Existing',
        role: 'admin',
        admin: true,
        shopping_lists: ['list-1'],
        external_identities: {
            legacy_provider: { subject: 'legacy-subject' },
        },
    }]);
    const linkedAt = new Date('2026-08-30T00:00:00.000Z');

    const user = await resolveGoogleUser(users, {
        subject: 'google-subject-1',
        email: 'person@gmail.com',
        firstName: 'Google',
        lastName: 'Name',
    }, { now: () => linkedAt });

    assert.equal(user._id, 'existing-user');
    assert.equal(user.encrypted_password, 'existing-password-hash');
    assert.equal(user.user_fname, 'Existing');
    assert.deepEqual(user.shopping_lists, ['list-1']);
    assert.deepEqual(user.external_identities.legacy_provider, {
        subject: 'legacy-subject',
    });
    assert.deepEqual(user.external_identities.google, {
        subject: 'google-subject-1',
        email_at_link: 'person@gmail.com',
        linked_at: linkedAt,
    });
});

test('Google sign-in creates a passwordless standard user when no account exists', async () => {
    const users = createUsersCollection();

    const user = await resolveGoogleUser(users, {
        subject: 'google-subject-2',
        email: 'new.user@gmail.com',
        firstName: '',
        lastName: '',
    }, { now: () => new Date('2026-08-30T00:00:00.000Z') });

    assert.equal(user.email, 'new.user@gmail.com');
    assert.equal(user.role, 'user');
    assert.equal(user.admin, false);
    assert.equal(user.email_verified, true);
    assert.equal(Object.hasOwn(user, 'encrypted_password'), false);
    assert.equal(Object.hasOwn(user, 'idToken'), false);
    assert.equal(Object.hasOwn(user, 'accessToken'), false);
});

test('Google subject remains the stable account key when the verified email changes', async () => {
    const users = createUsersCollection([{
        _id: 'linked-user',
        email: 'old@gmail.com',
        external_identities: {
            google: { subject: 'stable-subject', email_at_link: 'old@gmail.com' },
        },
    }]);

    const user = await resolveGoogleUser(users, {
        subject: 'stable-subject',
        email: 'new@gmail.com',
        firstName: 'Changed',
        lastName: 'Email',
    });

    assert.equal(user._id, 'linked-user');
    assert.equal(user.email, 'old@gmail.com');
});

for (const googleEmail of ['person.name@gmail.com', 'person+shopping@gmail.com']) {
    test(`Google sign-in does not alias ${googleEmail} to person@gmail.com`, async () => {
        const users = createUsersCollection([{ email: 'person@gmail.com' }]);

        const user = await resolveGoogleUser(users, {
            subject: `subject-${googleEmail}`,
            email: googleEmail,
            firstName: '',
            lastName: '',
        });

        assert.equal(user.email, googleEmail);
        assert.equal(users.users.length, 2);
    });
}

test('simultaneous first sign-ins resolve to one Google account', async () => {
    const users = createUsersCollection();
    const identity = {
        subject: 'simultaneous-subject',
        email: 'simultaneous@example.com',
        firstName: 'Same',
        lastName: 'Person',
    };

    const [first, second] = await Promise.all([
        resolveGoogleUser(users, identity),
        resolveGoogleUser(users, identity),
    ]);

    assert.equal(first._id, second._id);
    assert.equal(users.users.length, 1);
});

test('a concurrent link race resolves to the account that won the subject index', async () => {
    const candidate = { _id: 'candidate', email: 'candidate@example.com' };
    const winner = {
        _id: 'winner',
        email: 'winner@example.com',
        external_identities: {
            google: { subject: 'racing-subject', email_at_link: 'winner@example.com' },
        },
    };
    let subjectLookups = 0;
    const users = {
        async findOne(filter) {
            if (filter['external_identities.google.subject']) {
                subjectLookups += 1;
                return subjectLookups === 1 ? null : winner;
            }
            if (filter.email === candidate.email) return candidate;
            if (filter._id === candidate._id) return candidate;
            return null;
        },
        async updateOne() {
            const error = new Error('duplicate subject');
            error.code = 11000;
            throw error;
        },
    };

    const resolved = await resolveGoogleUser(users, {
        subject: 'racing-subject',
        email: candidate.email,
        firstName: '',
        lastName: '',
    });

    assert.equal(resolved._id, winner._id);
});

test('Google sign-in rejects an email account linked to another Google subject', async () => {
    const users = createUsersCollection([{
        email: 'person@gmail.com',
        external_identities: {
            google: { subject: 'other-subject', email_at_link: 'person@gmail.com' },
        },
    }]);

    await assert.rejects(
        resolveGoogleUser(users, {
            subject: 'new-subject',
            email: 'person@gmail.com',
            firstName: '',
            lastName: '',
        }),
        (error) => error instanceof GoogleAuthError &&
            error.statusCode === 409 &&
            error.code === 'google_identity_conflict'
    );
});

test('DiscountMate Google session has the same public response as password sign-in', () => {
    const response = createDiscountMateSession({
        email: 'admin@discountmate.app',
        role: 'admin',
        admin: true,
    }, {
        jwtSecret: 'test-secret',
        signToken: (claims, secret, options) => {
            assert.deepEqual(claims, {
                email: 'admin@discountmate.app',
                role: 'admin',
                admin: true,
            });
            assert.equal(secret, 'test-secret');
            assert.deepEqual(options, { expiresIn: '1h' });
            return 'discountmate-jwt';
        },
    });

    assert.deepEqual(response, {
        message: 'Signin successful',
        token: 'discountmate-jwt',
        role: 'admin',
        admin: true,
    });
});

test('Google identity index enforces one account per stable subject', async () => {
    let createdIndex;
    const db = {
        collection(name) {
            assert.equal(name, 'users');
            return {
                async createIndex(keys, options) {
                    createdIndex = { keys, options };
                    return options.name;
                },
            };
        },
    };

    assert.equal(await ensureGoogleIdentityIndex(db), 'unique_google_subject');
    assert.deepEqual(createdIndex, {
        keys: { 'external_identities.google.subject': 1 },
        options: {
            unique: true,
            sparse: true,
            name: 'unique_google_subject',
        },
    });
});

test('password authentication safely rejects a Google-only account without invoking bcrypt', async () => {
    const matched = await passwordMatchesUser('password', { email: 'google@gmail.com' }, () => {
        throw new Error('bcrypt must not receive a missing hash');
    });

    assert.equal(matched, false);
});
