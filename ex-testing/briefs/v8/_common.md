# v8 fleet — common context

Mission: extend the check/tooling layer under `.claude/scripts/` (and `checks/` if a check belongs there). Your lane owns exactly ONE new script file — never edit `check-example-work.mjs`, `check-work-deep.mjs`, `example-ownership.mjs`, or any `.starciwork` tree (fleet v7 is live-editing those).

## Style bar — read before writing
`scripts/check-example-work.mjs` and `scripts/check-work-deep.mjs` are the style canon. Match them:
- Header comment explains WHY the check exists (the incident/failure it prevents), not what it does.
- Every concept gets a named section comment (`// ---- concept N: ... ----`) explaining the reasoning.
- Descriptive variable/function names (`normDigestOf`, `resolveOwnedDirs`, `rootsFrom`) — no `x`, `tmp`, `d`.
- Compact but readable: blank lines between sections, no line > 120 chars, early returns over nesting.
- Reuse: `parseYaml` from `core/yaml.mjs`, `walk`/`FAMILIES` from `check-example-work.mjs`, `loadRecords`/`resolveOwnedDirs`/`repoRootFor`/`readWorkspace`/`hashOwnedDirs` from `example-ownership.mjs`. Never reimplement what those already do.
- Severity discipline from check-work-deep: REFUSE only when deterministically wrong; SUSPECT for heuristics; INFO for counts. A check that cries wolf gets ignored.
- Runnable standalone: `node scripts/<your-script>.mjs` must work, exit non-zero on REFUSE, print findings grouped by severity. `--tree <path>` option to check one tree.

## Testing
Run your script against both real trees (`examples/todo-app-backend/.starciwork`, `examples/ecommerce-app-be/.starciwork`) and paste the summary counts in your report. If `tests/` has check fixtures (`tests/*check*`/`*.spec.mjs` near work checks), add a fixture test matching that convention; otherwise note "no fixture convention found" instead of inventing one.

## Report
`ex-testing/lint/v8-<N>-REPORT.md`: what the script checks, design decisions, real findings it produced on the live trees (with verbatim lines), false-positive rate observed, what it deliberately does NOT check.
Done → `New-Item ex-testing/lint/done/v8-<N>.done`.
