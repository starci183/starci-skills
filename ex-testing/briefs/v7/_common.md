# v7 fleet — common context (read fully before your lane brief)

Mission: make the example `.starciwork` trees actually truthful — records, evidence, render captures, UAT runs. Audit findings: `ex-testing/lint/v6-3-REPORT.md` and `v6-4-REPORT.md` — READ THEM FIRST, your lane's items are indexed there.

## Trees
- `examples/todo-app-backend/.starciwork` — owns records for todo-app-backend AND todo-app-frontend (sibling dir)
- `examples/ecommerce-app-be/.starciwork` — owns records for ecommerce-app-be AND ecommerce-app-fe
- Gate: `node scripts/check-example-work.mjs` (from `.claude/`). Evidence tool: `node scripts/work-example.mjs` / `example-evidence.mjs` — check `--help` first.

## Hard rules
- NEVER mark evidence `stale: true` to clear a refusal — regenerate evidence by re-running the proof.
- NEVER fabricate a `provenBy`, `proves`, run result, capture file, or digest. If proof can't run, leave the record `todo` and write a `gap.*` record explaining why.
- `state: done` requires fresh evidence or a settled UAT run — no exceptions.
- Keep edits inside `.starciwork` trees only (plus `ex-testing/lint/` for your report). Product source changes are out of scope — if a record contradicts real code, fix the RECORD unless the code is verifiably wrong.
- Vietnamese product copy stays; yaml comments may be English.
- Do NOT touch `examples/*/src/**`, `packages/**`, or another lane's record families (your brief lists what you own).

## Phase markers
- Coordination via `ex-testing/lint/done/<lane>.done` files. When your lane finishes, `New-Item -ItemType File` your marker with a one-line summary inside.
- If your brief says "wait for phase-1": poll every 60s until `v7-1.done`..`v7-5.done` all exist (timeout 90 min → then proceed anyway and note it in your report).

## Deep check (new — v7-13 must run it)
`node scripts/check-work-deep.mjs` — semantic layer above the base gate: PROVENBY_AUTHORED, PROOF_COMMAND_DEAD, COMPOSES_PATH_DANGLING, DEP_STALE/NORM_UNRECORDED (needs `--write-baseline` after clean pass), CATALOG_DRIFT, REPO_UNBOUND + SUSPECT-tier surface/capability coverage. v7-13: run it, fold findings into your summary, then `node scripts/check-work-deep.mjs --write-baseline` to establish the dep-digest baseline once trees are clean.

## Report
Write `ex-testing/lint/v7-<N>-REPORT.md`: what you changed, what you could NOT prove and why, remaining gate refusals you observed (verbatim lines), and any record↔code contradiction you had to leave unresolved.
