# Apply steps table

Execute in order. Apply materializes an approved executable Preview; it never reinterprets one.

| Step | Decision or question | Required evidence | Required artifact | Stop condition |
|---:|---|---|---|---|
| 0 | Is inherited context unchanged and explicitly confirmed for writes? | Workspace, git, Context Lock, Preview lock and user confirmation | Confirmed `context-lock.apply.md/json` | Drift or ambiguity stops; pause for target repo, branch, worktree and exact boundary. |
| 1 | Is there one approved executable candidate? | Version-3 design record and explicit revision approval | Validated case, source map and state matrix | Plan HTML, screenshot alone or unsealed record is inadmissible. |
| 1A | Does the design-record seal verify? | Candidate, fixtures, screenshots and semantic manifest | Passing verifier and spec hash | Missing or changed artifact returns to Preview. |
| 1B | Does target effectively enforce full StarCi FE canon? | Effective ESLint config for a production probe | Passing lint-adoption audit | Partial plugin or inline config stops edits. |
| 2 | Has source, package or business truth drifted? | Current target/backend/tests versus record | Compatible/changed/blocking report | Drift requiring adaptation returns to Preview; never silently redesign. |
| 3 | Is every candidate file mapped to one target path? | Sealed source map and confirmed boundary | Candidate-to-target map | Unmapped or out-of-bound file stops. |
| 4 | Can a representative slice be materialized without substitution? | Candidate source, exact state fixture and target | Working candidate-equivalent slice | Substituted owner/component/contract/prop/token returns to Preview. |
| 5 | Can work be delegated without splitting shared decisions? | Spec hash, dependencies and file ownership | Non-overlapping worker packets | Workers cannot recreate UI from screenshots or redesign shared seams. |
| 6 | Did workers remain byte/semantic faithful to their packets? | Diffs, logs and candidate source | Coordinator-reviewed integration | Scope drift or unapproved API change is rejected. |
| 7 | Is each comparison the exact same state? | Route, viewport, DPR, locale, theme, persona and fixture hash | State identity matrix | A mismatched state makes comparison invalid. |
| 7A | Did the approved bytes actually land? | Sealed hashes, target working tree, `integrationEdits` | Passing `verify_apply_materialization.mjs` report | A missing target, an undeclared difference or an out-of-bounds path stops; declare the edit at Preview or return there. |
| 8 | Does production pass structural and visual parity? | Approved/production screenshots, trees and DOM | Per-state parity matrix | Structural drift has zero tolerance; visual drift needs measured noise evidence. |
| 9 | Does integrated code satisfy trust? | Record verifier, tests, typecheck, strict lint, rule tests, build and lint audit | Command ledger | Failure or suppression blocks completion. |
| 10 | Has a fresh closer audited the integrated result? | Sealed record, diff and parity matrix | Findings plus coordinator disposition | Closer may report, not redesign or silently patch. |

Return to Plan only when a product decision reopens. Return to Preview for candidate infeasibility,
target drift, missing state evidence, API/spec change or any unapproved visual/structural difference.
