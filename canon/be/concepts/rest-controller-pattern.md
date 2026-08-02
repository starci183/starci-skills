# REST controller pattern (Express 5 + Swagger/Scalar)

Source: `src/features/api/core/http/`, `src/modules/api/rest/`.

Controllers are grouped by area: `admin/`, `github/`, `keycloak/`, `minio/`, `mount/`, `payos/`,
`sepay/`, `stripe/`, `paypal/`, `nowpayments/`. `http.ts` is the gateway bootstrap.

## What a controller file contains

A `*.controller.ts` declares no types, enums or classes inline — they are imported from `dtos/`,
`types/` or `classes/`. Every DTO field carries an `@ApiProperty`, because Swagger and Scalar are
generated from those decorators and a field without one is invisible to every consumer reading the
docs.

The validation pipe is already **global** (`APP_PIPE` in `apps/core/src/app.module.ts`), so DTOs
validate themselves. Do not add `@UsePipes` per controller — a second, per-controller pipe is how two
routes end up validating under different rules.

## Bootstrap order in `http.ts`

CORS, then the cookie parser, then the validation pipe, then the Swagger/Scalar mount, then the Apollo
GraphQL gateway mount.

## Controllers do not hold business rules

A controller calls down into a domain service under `@modules/bussiness`. The rule itself lives there
— see [feature-layer](feature-layer.md) — so that GraphQL, a job and a webhook all reach the same
decision rather than three near-copies of it.

## Webhooks

Payment gateway webhooks live at `http/<vendor>/` and verify the vendor's signature **before** doing
anything else. Webhook bodies are untrusted input: always verify the signature, always be idempotent.
See [payment-gateways-and-webhooks](payment-gateways-and-webhooks.md).
