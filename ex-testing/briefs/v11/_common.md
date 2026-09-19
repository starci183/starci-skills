# v11 — format compression fleet (schema-level refactor)

GOAL (owner-approved): compress the .starciwork encoding ~3x without losing information.
- 1 feature = 1 file: inline `ac/` acceptance-criteria sub-records into the parent FR/BR record (an ac only deserves its own file if it has its own lifecycle/evidence — judge per case, justify splits).
- Drop hand-authored derived fields where the gate can compute them (provenBy, redundant owner duplication) — keep a `derived:` comment pointer if the schema still requires the field.
- Keep `state` vocabulary: todo | inprogress | done | uninvestigate.

WAIT GATE: do NOT touch a tree until these markers all exist: v10-1, v10-2, v10-3, v10-4, v10-5 AND v9-2..v9-10 (or the lane's report declares itself finished/blocked). Poll `ex-testing/lint/done/` every ~3min, max 60min, then proceed anyway noting which were absent.

SAFETY: every ref to a collapsed ac must be remapped to `parent#ac-id` (or dropped if it was the ac's own id). `grep -rn "ac\."` the tree before+after — zero dangling refs allowed. Evidence pinning recordDigests WILL stale after edits — re-run `scripts/example-evidence.mjs` for touched records. Run `check-example-work.mjs` + `check-work-deep.mjs` after: refusal count must not increase vs the v10-5 baseline. Marker `done/<lane>.done` + `lint/<lane>-REPORT.md`.
