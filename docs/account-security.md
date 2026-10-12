# Client account security

## Required configuration

Keep `SESSION_SECRET` configured. Authenticator setup also requires
`MFA_ENCRYPTION_KEY`: a cryptographically random 32-byte key encoded as either
64 hexadecimal characters or Base64. Save it using the secure Secrets form,
never in source files, commands committed to the project, or chat.

Configure this key in every environment that will enroll or authenticate
two-factor users. Without it, enrollment fails explicitly; no fallback
encryption key is used. Existing enrolled users cannot verify authenticator
codes without the correct key.

**Do not replace this key casually.** Active and pending authenticator secrets
must first be re-encrypted with a deliberate migration using the previous key.
Changing the session signing key does not change the authenticator encryption
key. Back up configuration through an approved secret-management process.

## Behavior

- Password changes verify the current password, require matching new passwords
  of 12–128 characters, and require a fresh authenticator or recovery code when
  two-factor authentication is enabled.
- Successful password changes sign out every session, including the initiating
  browser. Neither client references nor financial records change.
- Setup verifies the password, provides a QR code/manual key in a dedicated
  private screen, and expires after ten minutes. Confirmation must occur in the
  initiating session with a valid six-digit code before activation.
- Password-only sign-in creates an unauthenticated five-minute challenge.
  Client APIs remain inaccessible until a valid second factor is verified.
- Authenticator codes are replay-protected. Recovery codes are random,
  account-bound, hashed, single-use, and shown only when first generated.
- Disabling two-factor authentication or replacing recovery codes requires
  password and second-factor reauthentication and signs out other sessions.
- Limits persist in the database rather than resetting on process restarts.
- Existing preference-only two-factor flags are not treated as enrollment.
  Settings explains that setup must be completed; clients are not locked out
  by these legacy flags.
- Generic profile updates cannot change passwords or verified two-factor
  security. Ordinary user responses exclude password hashes. Sensitive
  enrollment/recovery responses are not logged or cached.
- Legacy application password hashes remain untouched.

There is no staff bypass or unverified recovery/reset flow. A user who has lost
both their authenticator and all recovery codes needs a separately designed,
verified account-recovery process.

## Verification

CORS and sensitive browser writes share an explicit trusted-origin policy.
It includes both existing Vercel frontends, configured CLIENT_URL origins,
configured Replit development domains, and the request's own HTTPS origin.
Only development permits the request's own HTTP origin. Do not permit arbitrary
Vercel/Replit subdomains or all development origins. An untrusted Origin is
rejected with 403 before handlers run; approved preflights retain credentialed
CORS headers. Non-browser requests without an Origin still require the same
authentication, JSON validation and second-factor checks.

`npm run test:security` checks password hashing, authenticated encryption,
account-bound ciphertext, trusted-origin boundaries, RFC TOTP vectors, expiration, replay protection and
fail-closed missing-key handling, without accessing a database.

`npm run test:balances:browser -- security.spec.ts` runs desktop/mobile security
flows using disposable identities and a temporary local database. The runner
generates its own encryption, session, and administration keys; it does not
enroll or change passwords for Mary or other shared clients. It covers credentialed
preflights, login and second-factor verification from each supported frontend,
including rejection of an untrusted frontend without consuming recovery codes.
Security tests do
not retain traces or screenshots containing enrollment material.
