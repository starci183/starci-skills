# tinkle-4 — scripts/checks/ consolidation (WAIT LANE)

Read tinkle/_common.md. WAIT GATE: poll `ex-testing/lint/done/` for `v11-5.done` (v11-5 edits the check scripts — collision if you move mid-edit). Max 60min, then proceed noting absence.

Then: move all `check-*.mjs` from `scripts/` AND `checks/*.mjs` into `scripts/checks/` — BUT check import references first: `grep -rn "checks/" scripts/ ops/ *.md` and fix every importer (relative paths, docs). `checks/` subdirs (architecture/, code-patterns/) move whole. Non-check scripts (build-*, compile-*, example-*) stay in `scripts/`. After moving: run `node scripts/checks/check-example-work.mjs` + one other check — must produce same verdicts as before the move (capture a before-run first for diff). Report moved files + import fixes + before/after gate counts.
