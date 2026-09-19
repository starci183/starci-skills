# tinkle-14 — kernel reads source, not .dist

Read `tinkle/_common-distless.md`.

Owns: `kernel/**`, `core/**`, `bin/`, `cli/`, `init/` — EXCEPT `kernel/model-policy.mjs` (tinkle-15) and op-resolution code `dispatcher.mjs`/`candidates.mjs`/`candidate-*.mjs` (tinkle-17).

Mission: every `.dist` reference in your files must point at the source path instead (e.g. `.dist/kernel/x.mjs` → `kernel/x.mjs`, `.dist/schemas/foo.json` → `schemas/foo.yaml` loaded via `core/yaml.mjs::parseYaml`). Remove any `ensureBuild`/build-trigger call sites in your scope. Find every `.dist` reference: grep `\.dist` under your dirs. Verify: a cold boot path works — kernel entry runs with NO `.dist` dir present (test by renaming `.dist` temporarily, run a smoke entry, rename back). Report: every ref changed + boot test result. Marker `done/tinkle-14.done`.
