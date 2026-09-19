# tinkle-15 — model source consolidation

Read `tinkle/_common-distless.md`. Owns: `model/**`, `modules/models/**`, `kernel/model-policy.mjs` ONLY.

Two model sources exist: old `model/*.yaml` (compiles to .dist/model/*.json) vs new `modules/models/*.yaml` (tinkle-2 output, includes selection.yaml). Decide canon: `modules/models/` is the target. Steps:
1. Diff `model/*.yaml` vs `modules/models/` — anything in old source missing from new module? Port the gap into modules/models yaml (report what was ported).
2. `kernel/model-policy.mjs`: make it read `modules/models/*.yaml` directly via `core/yaml.mjs` instead of `.dist/model/*.json`. If a json field has no yaml equivalent, report it — don't silently drop.
3. `model/` → `git mv model legacy/model`.
4. Delete nothing else; .dist/model deletion is tinkle-22's job.
Report: ported fields table + files changed. Marker `done/tinkle-15.done`.
