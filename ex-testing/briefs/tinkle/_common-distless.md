# TINKLE distless wave — kill .dist, legacy/ consolidation

Read `.claude/SKILL.md` first. Mission: `.dist/` is a generated build artifact — we are DELETING the build concept. Runtime must read SOURCE dirs directly. Old/superseded things move to `.claude/legacy/`.

## Canonical target (after this wave)
- `kernel/` = runtime spine source, read directly (no dist copy)
- `schemas/*.yaml` = canon (no .json compilation)
- `model/*.yaml` or `modules/models/*.yaml` = model data source
- `ops/` → `legacy/ops/` (modules/ops/*.yaml is the new canonical op manifest)
- `scripts/{checks,route}/` + other script domains
- `sqlite/`, `modules/`, `knowledge/` unchanged
- NOTHING may read `.dist/` or write it when done — `.dist` gets deleted at the end

## Rules
- Respect file OWNERSHIP boundaries in your brief — other lanes own other dirs; if you need a change in foreign territory, put it in your report's "needed elsewhere" section instead of editing.
- In-flight lanes: tinkle-4 is moving `scripts/check-*.mjs` → `scripts/checks/`; tinkle-10 is editing `modules/ops/ops/*.yaml`; v11-5 edits check scripts. Do NOT touch those files — note and move on.
- Marker `ex-testing/lint/done/tinkle-<n>.done` + report `ex-testing/lint/tinkle-<n>-REPORT.md`.
