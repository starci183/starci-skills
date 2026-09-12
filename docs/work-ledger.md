# The Work ledger

The product ledger is the canonical Work tree: `<repo>/.starciwork/features/**/index.yaml`, schema
`work/node@2`, laid out by [work-layout.yaml](../schemas/work-layout.yaml). There is no second list
of things to do. `execution/work-ledger.mjs` is the kernel's only door to it: it reads the tree
through `starci validate`, decides what may be scheduled, and writes back four things and nothing
else. The authored specification — SRS, SDS, the implementation record, gaps, assets — belongs to the
workflows that author it, and a kernel write preserves every one of those lines byte for byte.

## Decision kinds and executable kinds

`DECISION_KINDS` (`business`, `business-overview`, `architecture`) are answered, not executed. A
decision is settled by a collocated `completion.review`: a reviewer, actual authority provenance and
one passing observation per authored assertion. Nothing is launched into a worktree and no agent
writes code. `decisionCandidates(ledger,{scope})` returns the todo, eligible ones.

`EXECUTABLE_KINDS` (`implementation`, `uat`, `operations`, `ui`) are done by an operation agent in a
worktree. `executableCandidates(ledger,{scope})` returns the todo, eligible ones enriched with the
two things an operation contract cannot be written without:

- **allowlist** — the union of `implementation.changes[].files`. It is the operation's write scope,
  and `disjoint(a,b)` over path prefixes (a glob narrows to its literal directory) is what lets two
  operations run at once.
- **checks** — `extensions.work3.checks` entries `{assertion, command, scope, note}`. The kernel
  re-runs these itself; a report's own claim is evidence, not a verdict.

A candidate missing either arrives with `schedulable:false` and a `reason`. The kernel must refuse to
launch it rather than invent a scope or a check — that refusal is the point, not a gap to route
around. Today's authored trees are mostly decisions for exactly this reason: goal assessment has to
author an allowlist and checks before any operation is launchable.

## What the kernel may write

| Field | Written by | Why it is allowed |
| --- | --- | --- |
| `state` | `markDone`, `markReopened`, `markDecided` | operational; excluded from the semantic digest |
| `completion` | `markDone` (evidence), `markDecided` (review) | operational proof binding |
| `extensions.work3.kernel` | every transition | the kernel's own receipt: opId, dispatch, head, checks, verifiedBy, at, reopened[] |
| `<node>/evidence/<opId>/manifest.yaml` | `writeEvidence` | the `work/evidence@1` record `completion.evidence` names |

Nothing else. There is no kernel-owned prose, no status sentence appended to a description, no
rewrite of an authored `implementation` block.

Three rules follow from the validator and are enforced here rather than discovered later:

1. **In-flight is not a state.** Work v2 authors exactly `uninvestigate`, `todo` and `done`, so
   `markInProgress` records the launch in the kernel block and leaves `state: todo`.
2. **The kernel block is semantic.** `extensions` is not an operational field, so writing the receipt
   changes the node's `inputDigest`. Every transition therefore writes the kernel block first, reads
   the settled digest, and only then binds `completion` and the evidence manifest to it. Out of that
   order the validator answers `STALE_COMPLETION` or `STALE_EVIDENCE` on the receipt just written.
   Pass `inputDigest` (or a `digest` resolver) to skip the second validator run.
3. **Done names its proof.** `markDone` refuses unless every authored assertion is proven by a
   passing check that declares it, and the evidence manifest carries those same assertion ids —
   which is what `ASSERTION_COVERAGE` measures.

Every write re-parses the file and asserts the intended fields; on any failure, including a failure
of the second pass, the node's original bytes are restored, a freshly created evidence folder is
removed, and the call throws. A half-written ledger never survives a kernel crash, and a ledger the
validator would reject is never the thing the kernel leaves behind.

`ledgerSummary(ledger,{scope})` is the status view: counts per kind and state, what is eligible, and
the ids a run could pick up.
