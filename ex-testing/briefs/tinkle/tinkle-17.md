# tinkle-17 — ops/ → legacy/ops + kernel op resolution → modules/ops

Read `tinkle/_common-distless.md`. Owns: `ops/**`, `legacy/**`, and ONLY the op-resolution files in kernel: `dispatcher.mjs`, `candidates.mjs`, `candidate-*.mjs` (tinkle-14 owns the rest of kernel).

Mission:
1. `git mv ops legacy/ops`
2. Kernel op resolution must load op manifests from `modules/ops/ops/<id>.yaml` (new canonical, has route:+business context) — update dispatcher/candidates. NOTE tinkle-10 is editing those yaml files concurrently — read-only is fine, don't edit them.
3. If modules/ops yaml lacks a field the kernel needs (compare with legacy/ops/*/operator.yaml), code a fallback read of legacy/ops and LOG it + report the missing fields.
4. Grep whole repo for `ops/` path references pointing at the old dir (SKILL.md excluded — tinkle-20 owns it); fix code refs, leave doc refs for tinkle-20.
Verify: kernel resolves an op manifest from modules/ops. Report + marker `done/tinkle-17.done`.
