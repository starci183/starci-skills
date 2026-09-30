# todo-app-frontend

The Next.js todo frontend lives in the `apps/web` npm workspace.

## Overview

The Next.js app and its source live in `apps/web/`. The repository root owns the npm
workspace and the shared checks. A front end has no tests.

The frontend source of the todo app. It owns no `.starciwork`: the Work records of this product live in
`todo-app-backend/.starciwork`, and the records that describe these screens name this repository by name
(`impl.task.todo-app-frontend.task-list`, `ui.task.list`).

That is the rule the layout states - one canonical Work tree per project, owned by the backend - and it is
why a frontend change is still proven against a record it does not contain.

## Stack

Next.js, React, TypeScript, npm workspaces; UI primitives come from
`@starci/grammar`.

## Repository layout

- `apps/web/src`: Next.js routes, features, components, hooks and modules.
- `scripts/`: repository tooling.
- `docs/`: human documentation; the paired backend owns `.starciwork`.

## Development

Run `npm ci`, `node ../../packages/fe-kit/scripts/link-peers.mjs todo-app-frontend`, then
`npm run typecheck`, `npm run lint:check` and `npm run build`.

The app reads one environment variable, `NEXT_PUBLIC_API_GRAPHQL_URL` (the backend's GraphQL endpoint), only through
`apps/web/src/modules/config`. It has no default: `next dev` and `next start` need it set.

## Running the checks

```sh
npm ci
node ../../packages/fe-kit/scripts/link-peers.mjs todo-app-frontend
npm run typecheck && npm run lint:check && npm run build
```

The second line is what makes the first useful: `packages/fe-kit` is consumed as source through the
`@fe-kit/*` path alias, and bare imports resolve by walking up from the kit's own directory, where no
consumer's `node_modules` sits. The script junctions this app's installed `react`, `next`, `next-intl`,
`@starci/grammar` and their types into the kit so `tsc`, `eslint` and `next build` see exactly
one copy of each. `.github/workflows/ci.yml` runs the same line.

