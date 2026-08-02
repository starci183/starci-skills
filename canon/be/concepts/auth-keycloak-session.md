# Concept — Auth: Keycloak and session

Source: `src/modules/keycloak/`, `src/modules/session/`, `src/modules/membership/`.

The auth layer is three modules that are easy to confuse: Keycloak carries OIDC SSO, login and the
main RBAC; `session/` carries the device session; `membership/` carries the membership package.

## Keycloak

`jwks.service.ts` verifies the JWT against JWKS; `token.service.ts` and `user.service.ts` sit beside
it; `keycloak-oidc-redirect.service.ts` runs the redirect flow; `guards/` holds
`KeycloakAuthGraphQLGuard`, which every resolver uses (see
[`graphql-resolver-pattern.md`](graphql-resolver-pattern.md)), and `keycloak.decorators.ts` holds the
`@Keycloak()` decorators.

The flow: the front end redirects to Keycloak, the backend validates the token through JWKS, and then
a domain guard from `bussiness/guards/` — an enrolment or ownership check, for instance — is applied
at the feature layer with `@UseGuards(...)`. Identity and authorisation are two different guards, in
that order.

## Session

`src/modules/session/` manages the device session for multi-device login and caps how many devices
may be signed in at once. It is separate from Keycloak token validation and does not replace it.

## Membership

`src/modules/membership/` holds membership and subscription state. Its entitlement is **not** the AI
quota in [`ai-catalog-balancer-entitlement.md`](ai-catalog-balancer-entitlement.md) — two different
notions of quota, and mixing them is the mistake to avoid.

## Supporting infrastructure

`passport/` (strategy holder), `cookie/` (signed cookie), `cors/`, `throttler/` (rate limiting backed
by Redis storage), `crypto/` (hash, sign, encrypt) and `code/otp-challenge.service.ts` (email OTP).
`captcha/`, `csrf/`, `totp/` and `helmet/` are further security modules that are not documented in
detail here — read the source when one of them is in scope.
