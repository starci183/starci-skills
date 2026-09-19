# tinkle-13 — modules consistency gate

Read `tinkle/_common.md`. TINKLE produced `modules/{ops,models,goal,kernel}` + `schemas/` + `sqlite/` + `scripts/route/`. You verify they AGREE with each other and with the kernel sources they claim to describe.

## Checks to run (report each pass/fail)

1. `modules/ops/ops/*.yaml` ↔ `ops/*/operator.yaml`: every op id present, goal/nodeKinds/completionProfile not silently diverged — report diffs as a drift table.
2. `route:` keys in ops yaml ↔ what `scripts/route/route-op.mjs` actually reads — field names must match the resolver's code.
3. `modules/models/selection.yaml` rules ↔ `.dist/kernel/model-policy.mjs` logic: risk ladder, floor ladder, qualification gates — enumerate any rule present in code but missing in yaml (or vice versa).
4. `modules/goal/legality.yaml` state-variable vocabulary ↔ `produces:`/`consumes:` in ops yaml (tinkle-10 output) — every var used must be defined.
5. `modules/kernel/dispatch.yaml` + `verdict-contract.yaml` ↔ `scripts/route/dispatch-op.mjs` implementation (tinkle-12 output).
6. `sqlite/schema.sql` ↔ `.dist/kernel/ledger-db.mjs` DDL — diff the table/index/trigger lists.
7. `schemas/` index ↔ `.dist/schemas/` — any schema file missing from the new index.
8. Smoke-run the route scripts: `route-op` on 3 inputs, `route-model` on 3 inputs, `route-plan` if tinkle-11 landed — capture outputs.

## Deliverable

`ex-testing/lint/tinkle-13-REPORT.md` — drift table per check, severity-ranked (breaks-routing / breaks-contract / cosmetic). Do NOT fix files — report only; fixes go to owning lanes or a follow-up. Marker `done/tinkle-13.done`.

## Boundaries

READ-ONLY on everything. Write ONLY report + marker.
