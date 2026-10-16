Owner: knowledge/hfs/rules.yaml

# Legacy back-end rule coverage

## R141: Protected response cookies

`BE_COOKIE_ATTRIBUTES` applies to back-end cookies in both lite and full editions.
An Express or Fastify response writes cookies with options whose types preserve
`httpOnly: true`, `secure: true`, and `sameSite: "lax"` or `"strict"`. A shared
options object declared `as const` keeps those literals when spread into a call.
The rule identifies response methods from their declaration packages, so renaming
the receiver does not change the requirement. Write cookies through the response
cookie method; a hand-written `Set-Cookie` header is refused. Clearing a cookie or
writing an unrelated response header does not create a cookie and is accepted.

The edition-specific cases in `packages/eslint/be/cookies-coverage.spec.mjs`
exercise accepted option objects and rejected missing or unsafe attributes and
raw cookie headers against the shipped ESLint rule.
