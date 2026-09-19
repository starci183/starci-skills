# Lane R2 (devin) — ec: tests/infra module tree + axios + spec rewire

SCOPE (exclusive): `examples/ecommerce-app-be/src/tests/**` (e2e specs + infra + tests/{identity,order} dirs + src/tests/e2e/jest.config.js). Do NOT touch `src/modules`, `src/features`, `apps/`, `package.json`, root `jest.config.js`, `tsconfig*`.

Same restructure as R1 minus graphql (ec is REST — axios only). `src/tests/{identity,order}/` (ut-10's boot/wiring specs) also get organized under the tree if they fit (e.g. `src/tests/unit/` is NOT the convention — keep them at `src/tests/<app>/` as-is, just ensure they still work after moves).
Verify: `npx tsc --noEmit` clean; `npx jest --config src/tests/e2e/jest.config.js` green if docker is up.
