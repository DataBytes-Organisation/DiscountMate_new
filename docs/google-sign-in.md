# Google Sign-In operations guide

DiscountMate uses Google OpenID Connect only to establish identity. The Expo
client requests `openid`, `email`, and `profile`, sends the short-lived Google
ID token to `POST /api/users/auth/google`, and then retains only the returned
DiscountMate JWT.

## Google Cloud setup

Use distinct OAuth clients for web, iOS, and each Android signing certificate.
Development and production should use separate clients, preferably in separate
Google Cloud projects.

Configure the external consent screen with:

- App name `DiscountMate`.
- Homepage `https://discountmate.app`.
- Privacy and terms URL `https://discountmate.app/privacy-terms`.
- Authorized domain `discountmate.app`.
- Scopes `openid`, `email`, and `profile` only.

Keep the consent screen in testing while adding team Google accounts as test
users. Publish it only after web and native verification passes.

For web, register the exact origins and callback pages used by the app. Local
development normally uses `http://localhost:8081` and
`http://localhost:8081/login`. Production uses both `https://discountmate.app`
and `https://www.discountmate.app`, with `/login` registered for each host.

For iOS, create an iOS OAuth client for bundle identifier
`com.discountmate.app`. The native callback is
`com.discountmate.app:/oauthredirect`.

For Android, create one OAuth client for every certificate that can sign an
installed build. Each uses package `com.discountmate.app` and the matching SHA-1
for local debug, EAS development/preview, production upload, and Google Play App
Signing as applicable. A build signed with an unregistered certificate will
usually fail with `DEVELOPER_ERROR`.

## Environment configuration

Frontend build-time variables contain public client IDs:

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

The backend accepts a comma-separated audience allowlist:

```env
GOOGLE_OAUTH_CLIENT_IDS=web-id,ios-id,android-debug-id,android-release-id
```

Production startup fails when the backend audience allowlist is empty. In
GitHub, configure repository variables `GOOGLE_WEB_CLIENT_ID`,
`GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, and
`GOOGLE_OAUTH_CLIENT_IDS`. Deploy the backend allowlist before enabling the
frontend button.

Client IDs are public identifiers. Never commit or send OAuth client secrets,
credential JSON, ID tokens, DiscountMate JWTs, passwords, service-account keys,
or signing private keys.

## Development and rotation

Native OAuth requires a development build; Expo Go is not an authoritative
test for the registered bundle/package and redirect scheme. After changing a
native client ID or signing certificate, rebuild the app.

To rotate a client ID, add the new ID to the backend audience allowlist first,
deploy the backend, deploy clients using the new ID, and remove the old audience
only after old client versions no longer need it.

Common failures:

- `invalid_google_credential`: wrong audience, issuer, expiry, signature, or an
  unverified/missing email.
- `authentication_unavailable`: Google verification, persistence, or the native
  code exchange was temporarily unavailable.
- Redirect mismatch: the exact origin, callback URI, app identifier, or scheme
  is absent from the corresponding OAuth client.
- Android `DEVELOPER_ERROR`: package name and signing SHA-1 do not match the
  installed build.

Automated tests mock Google. Manual web, iOS, and Android tests must be completed
with consent-screen test users before production publishing.
