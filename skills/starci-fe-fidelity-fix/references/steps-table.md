# Fidelity Fix steps table

| Step | Decision | Evidence | Output | Stop condition |
|---:|---|---|---|---|
| 0 | Where may this fix run and write? | Workspace, request, git, `CONTEXT-LOCK.md` | Printed lock and confirmed write boundary | Ambiguity or drift stops. |
| 1 | Is the desired result already settled? | Explicit instruction, legacy render/source, approved revision, contract `why`, or test | Binding expected-result statement | Any product choice routes to Plan. |
| 2 | Does the target actually enforce canon? | Effective ESLint config for a production probe | Passing lint-adoption audit | Missing/weakened rules or inline config stops edits. |
| 3 | Is the comparison identity exact? | Route, viewport, locale, theme, auth persona, fixture/backend seed, owner state and reference commit | Frozen same-state identity | Any mismatch makes the comparison invalid; do not explain it as UI drift. |
| 4 | Who owns the defect? | Canon, source anchors, callers and render | One owner, exact files, touched-state matrix | Ownership expansion routes to Plan. |
| 5 | What is the smallest faithful correction? | Measured before state and binding reference | Bounded diff | New unsupported behavior, API or exception stops. |
| 6 | Does every touched state match under the frozen identity? | Browser before/after, tests and legacy/approved evidence | Fidelity report | Unexplained drift blocks handoff. |
| 6A | Do both sides of every comparison declare the same state? | Sealed `fidelity-record.json` | Passing `verify_fidelity_record.mjs` | Any disagreement on route, viewport, locale, theme, persona, owner state or fixture makes the comparison invalid, not failed. |
| 7 | Is trust still strict? | Tests, typecheck, lint, build and effective config | Command ledger | Suppression or failed lint adoption blocks completion. |
