# tinkle-16 — schemas: kill json compilation

Read `tinkle/_common-distless.md`. Owns: `schemas/**` + schema READERS in `scripts/**`, `tests/**`, `fixtures/**` — EXCEPT `scripts/check-*.mjs` and `scripts/checks/**` (tinkle-4/v11-5 in flight) and kernel files (tinkle-14).

Mission: every reader loading `.dist/schemas/*.json` must load `schemas/*.yaml` via parseYaml instead. Grep `\.dist/schemas` and `schemas/.*\.json` across your scope. If a consumer NEEDS json shape, yaml content is equivalent — convert at load. Also check `schemas/goal-plan.json` vs `goal-plan.yaml` duplicates — keep yaml as canon, delete json duplicates ONLY inside `schemas/` (not .dist). Report: reader list + changes. Marker `done/tinkle-16.done`.
