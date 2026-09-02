# Context for `backend.implement`

## Purpose

Context is the exact material already decided before any line of backend code is written. It answers
"what may this operator read, and whose decision is already made?" Context never expands the mutation
boundary and never turns evidence into authority.

Every reference is immutable for the invocation and bound by a `sha256:` fingerprint. Source-backed
observations additionally bind the observed source head.

## Context classes

| Context | Role in the decision | Authority status |
| --- | --- | --- |
| Business authority | The approved decisions the backend is allowed to encode: who may act, what is charged, what is refused, what a state transition means. | Required. The only source of business behaviour. |
| Frozen mutation contract | The operations, writers, stores, transaction boundaries, idempotency, migrations, and required proofs. | Required. The boundary the implementation may fill and may not widen. |
| Sibling patterns | The observed families this change must mirror: module layering, transport, validation, authorization, data access, transaction boundary, concurrency, idempotency, event delivery, exception identity, naming, type safety. | Required reusable law. The only source of valid conventions. |
| Backend source | The routed checkout and its head. | Evidence that the boundary belongs to the frozen source. |
| Knowledge | The recorded backend implementation law. | Reusable law. Never a substitute for the contract. |
| Prior receipts | Earlier implementation or conformance receipts for the same outcome. | Evidence and regression history. |

## Required context

Every invocation requires:

1. the approved business authority with at least one decision;
2. the frozen mutation contract with at least one operation;
3. at least one bound sibling pattern;
4. the routed backend source reference whose head equals `input.project.sourceHead`.

## The contract is frozen before code exists

`input.contract` arrives with `status: "frozen"` and a fingerprint. The boundary is settled before the
first product write, and the implementation fills it rather than negotiating with it. Every operation
names its transport, its single writer, the stores it touches, its transaction boundary, its
idempotency kind, the migrations it carries, the contract facets that must be proved, and the proof
kinds that will prove them.

Reaching for anything outside that list is not a smaller change than reopening the contract; it is the
same change made without a record. The operator stops with `CONTRACT_WIDENED` and returns the boundary
question to the contract owner.

## Business authority is input, never invention

`context.authority.decisions` is the complete set of business statements this implementation may
encode, and every operation cites the decisions it implements through `authorityDecisionIds`. An
identifier absent from that set is invalid input, because a business rule that no owner approved is
exactly what a passing test can otherwise legitimise.

The backend owns business authority, so an unresolved business question is not a judgement call taken
locally. It is a typed exit, `BUSINESS_AUTHORITY_MISSING`, addressed to the business owner, and the
same outcome is implemented again once the decision is approved and rebound.

## Sibling patterns are the only source of convention

`context.patterns` binds one reference per aspect. The implementation mirrors the family it names:
`ICQRSHandler` command handlers under `src/features/api/core/graphql/mutations/`, exceptions derived
from `AbstractException`, entity access through the injected primary entity manager, migrations under
the primary datasource. A convention no bound pattern publishes is refused rather than introduced, and
the refusal is recorded as `NEW_CONVENTION_REFUSED`.

An aspect the change touches with no pattern bound for it is `PATTERN_UNBOUND`. Guessing the family
from memory is how a second house style enters a codebase unnoticed.

## Boundary

Context is read-only. The operator writes product source only inside `input.scope.mutableFileRefs`,
and writes the receipt with every proof result under `input.project.artifactRootRef`. It does not edit
the contract, publish business authority, touch an observation-only file, or record a quality, visual,
or UAT verdict.
