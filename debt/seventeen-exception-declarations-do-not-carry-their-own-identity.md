---
title: Seventeen exception declarations do not carry their own identity
role: be
state: closed
cost: small
opened: 2026-08-14
closed: 2026-08-14
paths: [src/modules/platform/exceptions/errors]
---

## What was wrong

`be/canon/patterns/exception-identity.md` landed with its three rules measured against the back end,
and seventeen declarations disagreed with them. All seventeen are paid; all three rules are at
`error`.

**`exception-metadata-type-named-for-class` — four.** Constructors typed their metadata parameter as
the shared `AbstractExceptionMetadata`, so the failure owned no type of its own and had nowhere to put
a first field. Each now names an alias: `errors/rag-playground/invalid-question.ts`,
`errors/stream/connection.ts` — which had already declared one and simply was not using it — and both
`errors/weekly-challenge/weekly-challenge-reward-*.ts`.

**`exception-code-matches-class-name` — nine.** One was a defect rather than a spelling:
`ChallengeOtpNotFoundException` reported `CHALLENGE_NOT_FOUND_EXCEPTION`, a code
`ChallengeNotFoundException` in `errors/courses/` already owned, so a missing OTP challenge — thrown
from six auth handlers — and a missing course challenge reached the client as one failure. The course
class kept the code; the OTP one reports `CHALLENGE_OTP_NOT_FOUND_EXCEPTION`.

Four more were codes that had drifted from a class that was itself correct, and were edited in place:
`errors/courses/course-path-name-not-found.ts` (was `COURSE_DIR_NAME_*`, from a rename that never
finished), `errors/transaction/transaction-not-found.ts` (was `PREFLIGHT_*`), `errors/execa/failed.ts`
(was the unscoped `EXECUTION_FAILED_EXCEPTION`) and `errors/session/session-not-found.ts` (was missing
the suffix).

The three Keycloak declarations were settled the other way round, by moving the CLASS, because there
the code said more than the class did: `HeaderKidNotFoundException` never said a `kid` is a JWT header
claim, and `NAME-1` puts the folder's scope in the class name anyway, as `errors/cache/not-found.ts`
does with `CacheNotFoundException`. They are now `KeycloakJwtHeaderKidNotFoundException`,
`KeycloakJwtInvalidPayloadException` and `KeycloakJwksSigningKeyNotFoundException`, with their
metadata types and twelve referencing files renamed with them, and each code keeps its `KEYCLOAK_*`
prefix and gains the missing suffix.

**`exception-name-ends-in-exception` — four.** `ContentContextNotFound`, `CourseAlreadyEnrolledError`,
`TransactionExpiredError` and `PayOsReturnUrlAndPayOsCancelUrlMustBeRequiredError` each extended
`AbstractException` under a name no exception rule matches, so `require-exception-object-arg`,
`exception-extends-abstract` and `exception-in-errors-folder` skipped them and
`throw-abstract-exception` saw nothing at their throw sites. All four are `*Exception` now, with their
metadata types and codes following, across twenty-seven files.

## What the measurement changed

This entry first said a code is a wire contract, so paying it meant a coordinated release with
whatever front end matches on the old strings. That was an assumption, and checking it cost one
search: across `starci-academy-fe`, `starci-academy` and `starci-academy-main-ui`, exactly five codes
are matched — `INVALID_VOUCHER_EXCEPTION`, `VOUCHER_NOT_SUPPORTED_FOR_GATEWAY_EXCEPTION`,
`INSTALLMENT_CURRENCY_NOT_SUPPORTED_EXCEPTION`, `ENROLLMENT_NOT_FOUND_EXCEPTION` and
`JOB_POSTING_NOT_FOUND_EXCEPTION` — and none of the seventeen was among them. No e2e spec asserts on
`extensions.code` either. What was budgeted as a release turned out to be an afternoon.

The one cost the search does not cover is Sentry, which groups by code: the changed codes start new
groups and the old ones stop receiving events.
`errors/courses/payos-return-url-and-payos-cancel-url-must-be-required.ts` had a comment pinning its
code for exactly that reason — and that pin is what let the class keep a name no rule could see. The
comment now records the date the grouping key changed instead of pinning it.

## How it was verified

`tsc --noEmit` clean after each batch, the Keycloak unit suites green, and the rules re-run over
`src/**/*.ts` reporting nothing before each level flip in `sources/be/exception-identity.mjs`. The
consuming repository reads its levels from canon, so `scripts/sync-be-lint.mjs --write` carries the
flip across.
