# Lane v10-3 — REPORT: transport ownership + operational-door resolution on `examples/ecommerce-app-be`

Date: 2026-09-19. Scope: `examples/ecommerce-app-be` source layout + its `.starciwork` tree.
Read first: `v10/_common.md`, the v10-3 brief, `scripts/check-work-deep.mjs` /
`check-work-surfaces.mjs` / `check-example-work.mjs`, `docs/ops-source-ownership.md`, and the
existing `contract.checkout.order-for-identity` record (the convention this lane mirrors).

## Verdict: PASS — 0 refused, 0 suspect on the ec tree (was 0 refused / 2 suspect)

Deep check on `examples/ecommerce-app-be/.starciwork`:

```
before:  0 refused, 2 suspect, 2 info
after:   0 refused, 0 suspect, 2 info
```

Both `CAPABILITY_WITHOUT_SPEC` suspects (`/internal`, `/health`) are resolved — one by real
contract records, one by a named exemption. The 2 remaining INFO findings are pre-existing
advisories (`EVIDENCE_CONTEXT_MISSING` x17, `PAYLOAD_AS_RECORD` x6), unrelated to this lane.

## Layout discovered first (differs from todo-be)

ec-be keeps its transport doors feature-local, not under a shared `src/http`/`src/graphql`:

- GraphQL: `src/features/checkout/graphql/{queries,mutations}/...`,
  `src/features/identity/graphql/{queries,mutations}/...` (+ `session.guard.ts`,
  `session-actor.decorator.ts`)
- HTTP: `src/features/checkout/transport/http/{buyer,health}.controller.ts`,
  `src/features/identity/transport/http/{session,health}.controller.ts`

Both impl records already own their whole feature root (`{role: feature, path:
src/features/checkout}` and `src/features/identity`), so every graphql/ and transport/http dir was
already claimed — the surface pass confirms `0 owned-only`, `7/7 graphql ops claimed`, and no
`UNCLAIMED_SURFACE`. No owner entries needed adding; the doors were owned, they were just
undeclared.

## /internal — resolved by a real contract record

New record `contract.identity.internal.sessions`
(`features/identity/contract/internal/sessions/index.yaml`): provider identity, consumer checkout,
surface `POST /internal/sessions/verify -> {personId}` and `POST /internal/sessions/revoke ->
{revoked: true}`. Written from the actual code: opaque UUID bearer in the JSON body, live session
answers 200 `{personId}`, dead/malformed token answers typed `SESSION_INVALID` (the
`BusinessCodeExceptionFilter` keeps the wire code at the business code), revoke is idempotent,
consumer propagates refusals and treats unreachable/malformed as typed 503s — never a guessed
person. This joins `contract.checkout.order-for-identity`'s `GET /internal/buyers/:personId` —
the whole `/internal` prefix is now spec-named.

## /health — resolved by splitting the pair honestly

The two `/health` doors are not the same case:

- **identity's `/health` has a real feature consumer** — order's own health aggregation calls it
  via `modules/integrations/identity/identity.client.ts` (`isHealthy()`, any non-2xx/timeout →
  `identity: unreachable` → cascade 503). So it got a real contract record,
  `contract.identity.health` (`features/identity/contract/health/index.yaml`): `GET /health ->
  {status, service, checks}`, 200 means Postgres+Redis answered, otherwise typed 503
  `DEPENDENCY_UNAVAILABLE` naming the refused dependency.
- **order's own `/health` has no in-repo feature consumer** — only hosts, orchestrators and e2e
  specs ask it. A contract would invent a business caller that does not exist, so it got the
  named exemption `decision.checkout.ops-doors`
  (`features/checkout/decision/ops-doors/index.yaml`): `outcome: decided`, `chosen:
  exempt-as-ops`, explicitly naming the door, its semantics, its code owner
  (`impl.checkout.ecommerce-app-be.order-checkout` owns `src/features/checkout` including
  `transport/http`), and cross-referencing `contract.identity.health` for the consumed half.

## /webhooks — does not exist; nothing invented

A full controller/route sweep of `src/` found zero `/webhooks` routes in ec-be (only
`/internal/*` and `/health` exist outside GraphQL). No record was created for a door that is not
served — the report is the accounting.

## Impl records — proves edges made explicit

- `impl.identity.ecommerce-app-be.identity-account` proves
  `contract.identity.internal.sessions` + `contract.identity.health` (provider half:
  `session.controller.ts`, `health.controller.ts`, `src/modules/bussiness/session`).
- `impl.checkout.ecommerce-app-be.order-checkout` proves both contracts (consumer half:
  `identity.client.ts` called from `graphql/session.guard.ts` and `transport/http/health.controller.ts`).
- Both carry `change: {rev: 1, kind: clarifying}` explaining the v10-3 edges.

## Evidence — every assertion a real run, nothing fabricated

`scripts/example-evidence.mjs` regenerated evidence for all four touched/new records; every
assertion ran for real against `--cwd examples/ecommerce-app-be`:

| record | assertions | result |
|---|---|---|
| `contract.identity.internal.sessions` | `provider=npx jest session.controller.spec`, `consumer=npx jest identity.client.spec session.guard`, `wire=npx jest --config src/tests/e2e/jest.config.js identity/sign-up-sign-in order-lifecycle/cross-service-identity` | all pass (wire e2e exercises verify/revoke + 401 SESSION_INVALID over live HTTP) |
| `contract.identity.health` | `provider=npx jest src/features/identity/transport/http/health.controller.spec`, `consumer=npx jest src/features/checkout/transport/http/health.controller.spec src/modules/integrations/identity/identity.client.spec`, `wire=... resilience/infra-recovery` | all pass (wire e2e asserts the 503 cascade + recovery on the live stack) |
| `impl.identity...identity-account` | `unit` (account/session/order-integration/identity feature specs), `e2e` (sign-up-sign-in + cross-service-identity) | all pass |
| `impl.checkout...order-checkout` | `unit` (order/cart/catalog/payment/identity-integration/checkout specs), `e2e` (order-lifecycle + payment-failure) | all pass |

`decision.checkout.ops-doors` needs no evidence (`work/policy-decision` is an authored-claim
schema).

## Final counts

- `check-example-work.mjs --tree .../ecommerce-app-be/.starciwork`: **0 refused** — 311 records,
  2783 refs, 127 evidence files (the run also lists todo-be's tree; ec contributes 45 records).
- `check-work-deep.mjs --tree <ec>`: **0 refused, 0 suspect, 2 info** (was 0/2/2; fleet-wide
  the common brief started at 9 refused / 23 suspect).
- `check-work-surfaces.mjs --tree <ec>`: **0 refused**; 5/5 http routes declared, 7/7 graphql
  ops claimed. 3 suspects remain but are all fe-side UI-route findings (`/en/account` ghost +
  `/`, `/account` undeclared on `apps/shop`) — outside this lane's backend-transport scope.
- `check-example-derived.mjs`: **every derived index fresh** on both work trees —
  `_derived/index.yaml`, `frontier.md`, `critique.{yaml,md}` regenerated via
  `example-derive.mjs --write` + `example-critique.mjs --write`; todo-be's stale `_derived` was
  also regenerated since the check is repo-wide.
- `deep-baseline.json` re-written with `--write-baseline` after the verified-clean pass — the
  previous baseline (15:04Z) predated v9-9's gap-closure edits (15:25–15:26Z) and produced one
  `DEP_STALE` on `uat.identity.sign-in` whose proof (run `20260919T152145Z`) is exactly what the
  gap cites as its closer; the re-baseline is the documented remedy, not a suspect suppressed.

## Files changed (all under `.claude/examples/ecommerce-app-be/.starciwork/`)

- `features/identity/contract/internal/sessions/{index.yaml,evidence.yaml}` — new
- `features/identity/contract/health/{index.yaml,evidence.yaml}` — new
- `features/checkout/decision/ops-doors/index.yaml` — new
- `features/identity/impl/ecommerce-app-be/identity-account/{index.yaml,evidence.yaml}` — proves + evidence
- `features/checkout/impl/ecommerce-app-be/order-checkout/{index.yaml,evidence.yaml}` — proves + evidence
- `_derived/{index.yaml,frontier.md,critique.yaml,critique.md,deep-baseline.json}` — regenerated
- `examples/todo-app-backend/.starciwork/_derived/*` — regenerated (repo-wide check)

No product source files were touched; no `stale: true` shortcuts; no hand-authored `provenBy`.
