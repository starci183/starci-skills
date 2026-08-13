# Consolidate apply steps table

Execute in order. This half carries out an approved survey; it never re-decides one.

| Step | Decision | Evidence | Artifact | Stop condition |
|---:|---|---|---|---|
| 0 | Is inherited context unchanged and explicitly confirmed for writes? | Workspace, git, survey lock, user confirmation | Confirmed `context-lock.consolidate-apply.md/json` | Drift or ambiguity stops; pause for target repo, branch, worktree and exact files. |
| 1 | Is there an approved survey? | `verify_consolidation_plan.mjs` on the inherited plan | Validated cluster and call-site set | A missing survey routes to Plan; an unapproved one cannot be applied. |
| 2 | Is this cluster one the survey approved to act on? | Inherited verdict | Cluster admitted | A `keep-apart` verdict is a finding, not a backlog item. |
| 3 | Does the work stay inside the measured call sites? | Frozen call-site list versus the diff | Touched-file list matching the survey | Widening is unreviewed scope creep; narrowing is a caller left behind. A missed call site returns to the survey. |
| 4 | Is the correction the approved one? | Canonical target and the single approved prop | Bounded diff | A second prop, an appearance slot, or a substituted owner stops. |
| 5 | Did the superseded owner and its story go? | Diff | Removal in the same change | An orphan is a second word for the thing that now has one word. |
| 6 | Does every measured call site still render what it rendered? | Same-state before/after per call site | Sealed consolidation record | A missing render, a changed render or hash drift blocks handoff. |
| 7 | Is trust still strict? | Focused tests, typecheck, strict lint, build | Command ledger | Green tests do not prove parity and are not accepted in its place. |

One cluster per diff. A parity failure inside a batch cannot be attributed to the cluster that
caused it, and the batch then has to be unpicked to find out which one it was.
