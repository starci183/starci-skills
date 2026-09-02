# backend-source-application — outcome-id

One paragraph: which outcome was implemented, inside which frozen contract, and what measured that
the contract was filled rather than widened. Written by `backend.source.apply` as `response/response.md`;
the conformance and proof records that measure it live beside it in `response/data/`, one file each.

## Binding

| Field | Value |
| --- | --- |
| Outcome | the one thing implemented, as the person stated it |
| Feature | `feature-id` |
| Contract fingerprint | `sha256:0000000000000000000000000000000000000000000000000000000000000000` |
| Base | `0000000000000000000000000000000000000000` |
| Branch | `session/s-0000` |
| Commit | `1111111111111111111111111111111111111111` |

## Operations

| Operation | Transport | Writer | Transaction | Idempotency | Decisions |
| --- | --- | --- | --- | --- | --- |
| `operation-id` | graphql-mutation | `src/features/api/core/graphql/mutations/handler.ts` | single-transaction | request-token | BA-1 |

## Changes

| Path | Change | Operation | Before | After |
| --- | --- | --- | --- | --- |
| `src/features/api/core/graphql/mutations/handler.ts` | added | `operation-id` | — | sha256:1111111111111111111111111111111111111111111111111111111111111111 |

## Findings

| Code | Operation | File | Statement |
| --- | --- | --- | --- |
| `PATTERN_BOUND` | `operation-id` | `src/features/api/core/graphql/mutations/handler.ts` | the sibling family this aspect mirrors |
