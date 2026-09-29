# todo-app-frontend

The Next.js todo frontend lives in the `apps/web` npm workspace.

## Overview

The Next.js app and its source live in `apps/web/`. The repository root owns the npm
workspace, shared checks and coverage report; Playwright flows live in `e2e/`.

The frontend source of the todo app. It owns no `.starciwork`: the Work records of this product live in
`todo-app-backend/.starciwork`, and the records that describe these screens name this repository by name
(`impl.task.todo-app-frontend.task-list`, `ui.task.list`).

That is the rule the layout states - one canonical Work tree per project, owned by the backend - and it is
why a frontend change is still proven against a record it does not contain.

## Stack

Next.js, React, TypeScript, npm workspaces, Vitest and Playwright; UI primitives come from
`@starci/grammar`.

## Repository layout

- `apps/web/src`: Next.js routes, features, components, hooks and modules.
- `e2e/`: Playwright flows; `scripts/`: repository tooling.
- `docs/`: human documentation; the paired backend owns `.starciwork`.

## Development

Run `npm ci`, `node ../../packages/fe-kit/scripts/link-peers.mjs todo-app-frontend`, then
`npm run typecheck`, `npm run lint:check`, `npm run build` and `npm run test:unit`.

## Running the checks

```sh
npm ci
node ../../packages/fe-kit/scripts/link-peers.mjs todo-app-frontend
npm run typecheck && npm run test:unit && npm run lint:check && npm run build
```

The second line is what makes the first useful: `packages/fe-kit` is consumed as source through the
`@fe-kit/*` path alias, and bare imports resolve by walking up from the kit's own directory, where no
consumer's `node_modules` sits. The script junctions this app's installed `react`, `next`, `next-intl`,
`@starci/grammar` and their types into the kit so `tsc`, `eslint`, `vitest` and `next build` see exactly
one copy of each. `.github/workflows/ci.yml` runs the same line.

`npm run uat` drives the Playwright flows in `e2e/` against a served frontend on
`http://localhost:3000` (override with `UAT_BASE_URL`); the config declares no `webServer`, so the backend's
dev stack and both servers must already be up - the workflow's `live` job is the sequence that does it.
