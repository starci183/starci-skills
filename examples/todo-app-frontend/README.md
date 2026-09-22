# todo-app-frontend

The frontend source of the todo app. It owns no `.starciwork`: the Work records of this product live in
`todo-app-backend/.starciwork`, and the records that describe these screens name this repository by name
(`impl.task.todo-app-frontend.task-list`, `ui.task.list`).

That is the rule the layout states - one canonical Work tree per project, owned by the backend - and it is
why a frontend change is still proven against a record it does not contain.

## Running the checks

```sh
npm ci
node ../../packages/fe-kit/scripts/link-peers.mjs todo-app-frontend
npm run typecheck && npm run test:unit && npx eslint . && npm run build
```

The second line is what makes the first useful: `packages/fe-kit` is consumed as source through the
`@fe-kit/*` path alias, and bare imports resolve by walking up from the kit's own directory, where no
consumer's `node_modules` sits. The script junctions this app's installed `react`, `next`, `next-intl`,
`@starci/grammar` and their types into the kit so `tsc`, `eslint`, `vitest` and `next build` see exactly
one copy of each. `.github/workflows/todo-app-example.yml` runs the same line.

`npm run uat` drives the Playwright flows in `uat/` against a served frontend on
`http://localhost:3000` (override with `UAT_BASE_URL`); the config declares no `webServer`, so the backend's
dev stack and both servers must already be up - the workflow's `live` job is the sequence that does it.

