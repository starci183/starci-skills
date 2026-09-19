# tinkle-23 — post-migration E2E verify (WAIT-LANE)

Read `tinkle/_common-distless.md`. WAIT for `ex-testing/lint/done/tinkle-22.done`.

Mission — full-system verification after .dist removal:
1. Boot: kernel entry runs, engine loads, no `.dist` anywhere
2. Route: `node scripts/route/route-op.mjs --intent direction --nodeKind ui` and `route-model.mjs` still resolve
3. Checks: run checks suite (new `scripts/checks/` locations if tinkle-4 landed, else old paths)
4. Example gate: run one `.starciwork` example gate end-to-end (todo-app-backend)
5. Modules load: every `modules/**/*.yaml` parses via `core/yaml.mjs::parseYaml`
Report `tinkle-23-REPORT.md` per-step pass/fail + evidence. Marker `done/tinkle-23.done`.
