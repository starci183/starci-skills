# Lane v4-2 — ec-be REST doors → canonical GraphQL transport

Scope: `.claude/examples/ecommerce-app-be/**` only. The `starci-be/rest-door-needs-a-reason`
rule stayed `error` throughout — the four findings were removed by migrating the user-facing
JSON APIs to code-first GraphQL, exactly as the todo example does it. No rule was weakened,
no eslint-disable was added.

## Endpoint → resolver migration map

Identity service (`apps/identity`, schema mounted by
`src/features/identity/graphql/graphql.module.ts`):

| Retired REST door | GraphQL operation | Resolver |
|---|---|---|
| `POST /auth/register` | `register(input: RegisterInput!)` | `src/features/identity/graphql/mutations/session/register/register.resolver.ts` |
| `POST /auth/sign-in` | `signIn(input: SignInInput!)` | `src/features/identity/graphql/mutations/session/sign-in/sign-in.resolver.ts` |
| `GET /accounts/:personId` | `account(personId: ID!)` | `src/features/identity/graphql/queries/account/account/account.resolver.ts` |

Order service (`apps/order`, schema mounted by
`src/features/checkout/graphql/graphql.module.ts`):

| Retired REST door | GraphQL operation | Resolver |
|---|---|---|
| `GET /cart` | `cart` | `src/features/checkout/graphql/queries/cart/cart/cart.resolver.ts` |
| `POST /cart/items` | `addCartItem(input: AddCartItemInput!)` | `src/features/checkout/graphql/mutations/cart/add-cart-item/add-cart-item.resolver.ts` |
| `DELETE /cart` | `clearCart` | `src/features/checkout/graphql/mutations/cart/clear-cart/clear-cart.resolver.ts` |
| `POST /orders` | `placeOrder(input: PlaceOrderInput!)` | `src/features/checkout/graphql/mutations/order/place-order/place-order.resolver.ts` |

The `Idempotency-Key` request header the old `POST /orders` read now travels inside
`PlaceOrderInput.idempotencyKey`, matching the canonical nivo-backend convention of carrying
idempotency in the mutation input.

## Transport shape (mirrors todo)

- `@nestjs/graphql` + `@nestjs/apollo` (Apollo driver, Nest 10 majors), `graphql` — versions
  pinned to the same majors as `examples/todo-app-backend`.
- Code-first `autoSchemaFile: true`, `sortSchema: true`, `path: "/graphql"`, introspection on,
  playground off; context exposes `{ req, res }`.
- `formatError` unwraps `AbstractException` and stamps `extensions.code` with the full
  `*_EXCEPTION` code plus the exception's metadata (reason, productId, requested, available…)
  beside it.
- One resolver + one module per operation under `graphql/{queries,mutations}/<cap>/<op>/`,
  each with `graphql-types/{input,response}.ts` — the todo nested-operation structure.
- Resolvers are thin: `@SessionActor()` actor extraction → existing service call → response
  DTO. `AccountService.register/verifyCredentials/getAccount`, `SessionService.issue`,
  `CartService.list/add/clear`, `CatalogService.list`, `OrderService.place`,
  `OrderApiClient.getBuyerStatus` — all called exactly as before; no domain logic moved.
- Checkout's session enforcement is `SessionGuard` ported to `GqlExecutionContext`
  (`src/features/checkout/graphql/session.guard.ts`) applied class-level on every guarded
  resolver, preserving the original class-level guard semantics. It still verifies the bearer
  against identity's `/internal/sessions/verify` over HTTP and still throws
  `SessionInvalidException` on the same refusal paths.

## REST doors kept (sanctioned, still pass the rule untouched)

- Identity: `GET /health` (probe), `POST /internal/sessions/verify`,
  `POST /internal/sessions/revoke` (machine routes — order's guard and session revocation
  are service-to-service).
- Order: `GET /health` (probe), `GET /internal/buyers/:personId` (machine route — the
  identity→order `contract.checkout.order-for-identity` provider that answers `hasOrders`).

## Deleted

- `src/features/identity/transport/http/sign-in.controller.ts` (+ spec)
- `src/features/identity/transport/http/account.controller.ts` (+ spec)
- `src/features/checkout/transport/http/cart.controller.ts` (+ spec)
- `src/features/checkout/transport/http/order.controller.ts` (+ spec)
- `src/features/checkout/transport/http/session.guard.ts` (+ spec) — moved to `graphql/` and
  re-specialised for `GqlExecutionContext` (no REST door consumes it anymore).
- Feature modules (`identity.module.ts`, `checkout.module.ts`) no longer mount the retired
  controllers/guard; both `apps/*/src/app.module.ts` composition roots now import their
  GraphQL module. Boot specs assert resolvers instead of controllers.

## E2E

- New `src/tests/infra/integrations/graphql/` — `E2EGraphqlService` is a real Apollo
  `HttpLink` client POSTing `{query, variables}` (plus optional `authorization: Bearer`) to
  each spawned service's `/graphql`, keyed per (service, bearer). Refusals resolve into a
  `GraphqlObserved` envelope (`httpStatus`, `data`, `errors`, `errorCode`, `errorMessage`,
  `raw`, `durationMs`) so `*_EXCEPTION` codes are asserted on
  `errors[0].extensions.code`/`errorCode`, not thrown. Apollo's cache-injected `__typename`
  is stripped from observed `data` — client bookkeeping, not the door's contract.
- All user-facing journeys now drive GraphQL: `identity/sign-up-sign-in`,
  `checkout/checkout-journey`, `checkout/payment-failure`,
  `order-lifecycle/cross-service-identity`, `order-lifecycle/order-history` (+ helpers).
- Assertions carry the full codes: `REQUEST_INVALID_EXCEPTION`, `EMAIL_TAKEN_EXCEPTION`,
  `INVALID_CREDENTIALS_EXCEPTION`, `PERSON_UNKNOWN_EXCEPTION`, `SESSION_INVALID_EXCEPTION`,
  `CHECKOUT_REFUSAL_EXCEPTION` (with `reason`/`requested`/`available` metadata),
  `ORDER_SERVICE_UNAVAILABLE_EXCEPTION`.
- REST axios is used only for `/health` and `/internal/*` — the sanctioned doors.

## Verification

- `npx eslint src` — **0 errors** (the four `rest-door-needs-a-reason` findings are gone; the
  rule itself is untouched). `npx eslint "src/**/*.ts" "apps/**/*.ts"` (the `lint` script) —
  also clean.
- `npx tsc --noEmit` — **clean, exit 0**.
- `npx jest` — **39/39 suites, 209/209 tests pass**.
- `npx jest --config src/tests/e2e/jest.config.js` — **7/7 suites, 10/10 tests pass** on the
  real Docker stack (Docker Desktop 4.76.0 / engine 29.5.2, compose v5.1.4): per-run postgres
  + redis containers, both Nest apps spawned from `dist/`, live `/graphql` traffic.

Two mid-run fixes were needed to get there: the stack serves the compiled `dist/` output, so
a rebuild (`npm run build`) was required before the spawned apps exposed `/graphql`; and
Apollo Client 4 always injects `__typename`, which the e2e envelope now strips before specs
assert payload shapes.

## Remaining

- Nothing outstanding in scope. The only remaining `@Controller`s are the five sanctioned
  doors listed above; a sweep found no stale imports of the retired controllers or the old
  HTTP session guard, and no spec hits a retired REST path.
- Note for future lanes: the e2e stack's `ensureBuilt()` only builds when `dist` entries are
  missing — after transport-level changes, `npm run build` must be re-run manually before the
  e2e suite reflects them.
