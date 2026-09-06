const test = require('node:test');
const assert = require('node:assert/strict');

const userRouter = require('../src/routers/user.router');
const { User } = require('../src/schemas/user.schema');

test('user router exposes the rate-limited Google authentication endpoint', () => {
    const route = userRouter.stack
        .filter((layer) => layer.route)
        .find((layer) => layer.route.path === '/auth/google');

    assert.ok(route);
    assert.equal(route.route.methods.post, true);
    assert.equal(route.route.stack.length, 2);
});

test('user schema accepts a verified Google-only account without password or names', () => {
    const user = new User({
        email: 'new.user@gmail.com',
        email_verified: true,
        role: 'user',
        external_identities: {
            google: {
                subject: 'google-subject-1',
                email_at_link: 'new.user@gmail.com',
                linked_at: new Date('2026-08-30T00:00:00.000Z'),
            },
        },
    });

    const validationError = user.validateSync();
    assert.equal(validationError, undefined);
});
