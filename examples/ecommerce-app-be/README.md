# ecommerce-app-be

Two NestJS ecommerce services share the HFS backend repository tree.

## Overview

This backend example uses the HFS repository tree. Two NestJS applications live under
`apps/identity` and `apps/order`. Their composition roots import explicit public APIs from
`src/features` and `src/modules/{domain,platform,integrations}`. The paired
`examples/ecommerce-app-fe` reads this backend's port projection and shares its product Work tree.

## Stack

NestJS, TypeScript, npm workspaces, PostgreSQL, Redis and GraphQL. The dev stack is declared
in `.starcistacks/dev`.

## Repository layout

- `apps/identity/src` and `apps/order/src`: startup and Nest composition only.
- `src/features/{identity,checkout}`: HTTP and GraphQL adapters under `transport/`.
- `src/modules/domain`: account, session, catalog, cart, order, and payment capabilities.
- `src/modules/platform`: config, Postgres, Redis, and exception infrastructure.
- `src/modules/integrations`: cross-service HTTP clients.
- `.starciwork`: product records and implementation references for both backend and frontend.
- `.starcistacks`: the dev stack declaration, compose fragments, and resolved port projection.
- `docs/TESTING.md`: verification commands and suite boundaries.

Each feature and module capability has an `index.ts` public entry. The root package exports
those entries through `ecommerce-app-be/features/*` and `ecommerce-app-be/modules/*`, so the
application workspaces can compose them without importing private files.

## Development

From this directory run `npm ci`, then `npm run typecheck`, `npm run lint:check`,
`npm run build` and `npm run test:unit`. `docs/TESTING.md` describes the live stack gate.

## Work

The backend owns [`.starciwork`](.starciwork/index.yaml) product records for both services
and the paired frontend.

## Runtime projection

`.starcistacks/dev/infra/metadata.json` is the resolved port map for both backend services and
the paired frontend. The backend config services and frontend readers use this file unless
`ECOMMERCE_APP_BE_METADATA` names another projection. The identity and order applications
provide separate environment overrides for their listen and dependency URLs.

The dev stack's runbook is `.starcistacks/dev/README.md`. The Sonar declaration points at the
shared host extension `.claude/ext/sonar`; this embedded example has no CI Sonar scan token.

## Verification

From this directory run `npm run typecheck`, `npm run lint:check`, `npm run build`, and
`npm run test:unit`. The unit suite includes both Nest composition specs. From the parent
`.claude` tree, run `node scripts/checks/canon-scan.mjs --root examples/ecommerce-app-be --json`
and `node scripts/checks/check-starcistacks.mjs examples/ecommerce-app-be`.

`npm run test:e2e` and `node scripts/live-proof.mjs` need the declared Postgres, Redis, and
application processes. There are exactly two test kinds: unit `*.spec.ts` beside the source and e2e
`*.e2e-spec.ts` under `src/tests/e2e/`. Narrow an e2e run with jest arguments, for example
`npm run test:e2e -- checkout/checkout-journey` or `npm run test:e2e -- resilience`.
See `docs/TESTING.md` for the suite boundary. Existing Work evidence
retains its recorded revisions; the derived index reports stale proof where source or records
changed.
