# Consolidate survey steps table

This half writes a proposal and changes no code. Every step protects a measurement that Apply
inherits and cannot retake.

| Step | Decision | Evidence | Artifact | Stop condition |
|---:|---|---|---|---|
| 0 | Where may this run, and what may it write? | Workspace, request, git, `CONTEXT-LOCK.md` | Printed lock plus `context-lock.consolidate-plan.md/json` | Ambiguity stops. The write boundary is the artifact root and nothing else. |
| 1 | Is this consolidation at all? | Request and current render | Admission statement | A result that should LOOK different routes to Plan; matching a named reference routes to Fidelity Fix. |
| 2 | What is in scope? | Named app, route, folder or file set | Stated scope | An unstated scope reports whatever it walked and cannot be compared with the last survey. |
| 3 | What clusters exist, and how big are they? | Imports and call sites at the current tree | Frozen members and call sites per cluster | Counting string occurrences inflates a cluster above a genuinely worse one. Editing anything here destroys the measurement. |
| 4 | Same thing, or same picture? | Domain entity, flag cost, appearance need; layer canon | One verdict per cluster | An undecided cluster is not carried forward. |
| 5 | What does each verdict cost? | Canonical target, prop delta, extraction anchor | Ranked proposal by call sites reached | Two props for two callers, an appearance slot, or a new owner from two call sites all stop. |
| 6 | Which clusters may be applied? | Explicit response after reading the table | `verdicts-approved` survey | Stop and wait. A ranking is not an instruction. |
| 6A | If the answer is ambiguous, was the default safe? | One re-ask on the clusters in doubt | Those clusters defaulted to `keep-apart`, with the reason | A default that would still edit something stops: doing nothing is the reversible option, a wrong merge is not. |
| 7 | Is the survey self-consistent? | `verify_consolidation_plan.mjs` | Passing verifier | Unmeasured call sites, an unexplained keep-apart, or an approval nobody gave blocks routing. |

Fan out the sweep across subtrees if the scope is wide, and merge the results before ranking:
a comparison made inside one subtree cannot see the third copy in the next one.
