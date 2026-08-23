---
title: Frontend design requests
---

# Frontend design requests

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@request-schema` | `requests/request.schema.json` | file | validate one durable frontend design request |
| `@rejects-schema` | `requests/rejects.schema.json` | file | validate the table of rejected source attempts |
| `@validate-request` | `scripts/validate-design-request.mjs` | script | validate one request or the complete queue |

## Record

`requests/*.request.json` is the durable queue between feedback intake and design resolution. A request may
describe any observable frontend UI or user-flow mismatch, including hierarchy, navigation, interaction,
responsive behavior, accessibility, state presentation, content structure or iconography.

A request is evidence and work intent. It is not product truth, grammar, principle or proof that a reported cause
is correct. `starci-fe-design-refactor` reproduces the feedback, corrects and proves product source first, then
creates or updates the request. `starci-fe-design-resolve` audits that source attempt, replaces it when wrong,
updates durable authority and closes the request.

## Law

Every request preserves the owner's feedback and expected outcome without prematurely choosing the failed layer.
The resolver records the final authority disposition:

- product-specific meaning, outcomes, semantic ownership and durable behavior belong to the routed grammar;
- product-neutral visual situations belong to principles only when reusable evidence supports the generalization;
- an application or enforcement miss still receives the smallest executable grammar/principle regression case so
  the same accepted feedback cannot silently recur.

Broad intake does not authorize invented business capability. A feedback item that changes actors, entitlements,
operations, backend capability or product truth remains in the queue as `blocked` until the owning business
authority is accepted.

`requests/rejects.json` is the append-only table of source attempts rejected during resolution. A reject preserves
the request id, affected paths, reason and evidence before the resolver overwrites the product with the corrected
attempt. Rejection updates the same request; it never creates a duplicate request for the same expected outcome.

## Lifecycle

| Status | Owner | Meaning |
|---|---|---|
| `open` | `starci-fe-design-refactor` | source was corrected/proved or the request explicitly records why source is blocked; authority resolution remains |
| `in-progress` | `starci-fe-design-resolve` | exact request set and write boundary are being resolved |
| `blocked` | resolver | required evidence, business authority, access or approval is missing |
| `resolved` | resolver | authority, source and proof are complete |
| `superseded` | resolver | another request owns the same outcome and names the replacement |

Requests remain in this directory after resolution. Status changes in place so links and review history remain
stable. File names are `<id>.request.json`, and `id` is immutable.

## Rules

1. Accept every concrete UI or user-flow feedback item that identifies a project and a recoverable surface or
   expected outcome; uncertainty becomes an explicit hypothesis, not rejection.
2. Redact secrets and private provider/tool output. Durable evidence uses stable references or concise summaries.
3. Intake corrects and proves the exact product source first, then writes or updates the request. It does not edit
   grammar or principles.
4. Resolution audits the source attempt. If it is wrong, append one reject row before overwriting source and update
   the same request with the replacement paths/proof.
5. Resolution updates at least one routed grammar or principle authority path before a request can become
   `resolved`; the request must also retain the final applied source paths and passing proof.
6. Principle changes require reusable product-neutral evidence. A product owner ruling may update the routed
   grammar without pretending to be universal law.
7. Conflicting requests are not resolved in one batch until their expected outcomes are reconciled.
8. External publication, package release, push and deployment require the authority already granted by the user;
   queue membership alone grants none of them.
9. Run `node scripts/validate-design-request.mjs --all` before committing request changes.

## Output

```text
request: <id>
status: <open | in-progress | blocked | resolved | superseded>
scope: <project/role and surfaces>
feedback: <preserved owner outcome>
authority: <pending | grammar | principle | both>
implementation: <pending | planned | applied>
proof: <pending | passed | failed | blocked>
```

## Stops

- A request would persist credentials, raw private conversation content or temporary signed URLs.
- Project identity cannot be resolved and no safe durable project key can be recorded.
- A source attempt failed but the resolver overwrites it without first recording a reject row.
- A resolver attempts to close a request without an authority change, final applied source and passing proof.
- Two selected requests require mutually exclusive outcomes and no owner ruling reconciles them.
