# Lane v4-2 — ec-be REST doors → canonical transport

SCOPE (exclusive): `examples/ecommerce-app-be/**` only.

## Context

`ecommerce-app-be` is a NestJS REST-only backend (identity + order services, axios E2E). Canon `@starci/eslint-canon-be` rule `starci-be/rest-door-needs-a-reason` flags every `@Controller` that cannot show one of four sanctioned reasons for not being GraphQL: probe (`/health`), external webhook, bytes payload (FileInterceptor/StreamableFile/@Res), machine (`pods|internal|agents` routes) or non-user identity (`api/ops`, OperatorGuard/ServiceToken).

Currently flagged (4 errors — the only remaining lint debt; `npx eslint src` shows exactly these):
- `src/features/identity/transport/http/sign-in.controller.ts` (`@Controller("auth")`: register + sign-in)
- `src/features/identity/transport/http/account.controller.ts`
- `src/features/checkout/transport/http/cart.controller.ts`
- `src/features/checkout/transport/http/order.controller.ts`

These are user-facing JSON APIs — the canonical home for them is GraphQL, NOT a weakened lint config. The mission directive is "kiến trúc phải chuẩn" (architecture must be standard/correct). Do NOT disable, downgrade, or scope-off the rule; do NOT add eslint-disable comments.

## Tasks

1. Add NestJS GraphQL transport to both services the way the todo example does it — study `examples/todo-app-backend/src/features/todo/graphql/graphql.module.ts` for the pattern: `@nestjs/graphql` + Apollo driver, code-first (`autoSchemaFile: true`), `formatError` mapping `AbstractException` `code` onto `extensions.code`. Add needed deps (`@nestjs/graphql`, `@nestjs/apollo`, `graphql`, `graphql-tools`/`@apollo/server` as required by the Nest version — match whatever todo-app-backend's package.json pins for the same majors).
2. Migrate the 4 controllers' endpoints to code-first resolvers under `src/features/<cap>/graphql/<operation>/` mirroring todo's structure (one resolver+module per operation, e.g. `mutations/session/sign-in/`). Keep the same behavior, exceptions, guards and service calls — transport changes, domain does not.
   - auth: `register`, `signIn` mutations (session-establishing, no session yet — anonymous mutations).
   - account: read query(ies) for the signed-in account.
   - cart: `cart` query + `addCartItem`-style mutation(s) matching existing endpoints.
   - order: checkout/order operations as mutations/queries matching existing endpoints.
   - If identity and order are SEPARATE Nest apps (apps/… or multi-main), put each service's GraphQL module in its own app's composition root.
3. Delete the 4 controllers (and their now-dead wiring). Keep any legitimately-justified REST door (e.g. a `/health` probe passes the rule untouched — do not remove it).
4. Update E2E: `src/tests/` axios clients hitting those endpoints must exercise the GraphQL transport instead — use a GraphQL client (todo-app-backend uses an E2E GraphQL service under `src/tests/infra/integrations/graphql/` — mirror it: real client over HTTP to the spawned service's `/graphql`). Assert `errors[0].extensions.code` carries the full `*_EXCEPTION` codes (todo convention). Do not weaken assertions to transport-level only.
5. Keep everything canon-clean: run `npx eslint src` → 0 errors (the rule must stay `error`); `npx tsc --noEmit` clean; `npx jest` all green; run the E2E suite for the touched journeys (docker stack infra exists under `src/tests/infra/` — it spins real services; run it and fix failures; if docker is unavailable in your env, report that explicitly).
6. Report to `D:/Repositories/starci-academy-backend/.claude/ex-testing/lint/v4-2-REPORT.md`: migration map endpoint→resolver, lint/tsc/jest/e2e status, anything left.

## Rules

- English only in code/comments/tests.
- Preserve existing naming (`modules/bussiness/*` capabilities called by doors; resolvers are thin: actor extraction → command/query bus → service, matching todo's resolver shape).
- If you judge a specific endpoint genuinely cannot be GraphQL under the four sanctioned reasons, document the reason in a JSDoc on the resolver/controller instead of weakening the rule.
