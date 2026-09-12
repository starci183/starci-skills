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
around. What it does instead is create one `work.author` operation for that node, whose single write
scope is the node's own `index.yaml` and whose single check is the whole-tree validator: completing an
authored record is work, not a chore for the user, and inside that file `state`, `completion` and
`extensions.work3.kernel` stay the kernel's. The bound is one author op per node per workflow, and a
record still incomplete after it was accepted is the question the user has to answer. See **Ledger
incomplete → work.author** in [workflow-kernel.md](workflow-kernel.md).

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

## Repository rule

A node may say which repository delivers it: `extensions.work3.scope.repository`. `executableCandidates(ledger,{repository})` drops nodes whose declared repository differs from the one asked for (the kernel asks with its own `package.json` name), so a frontend leaf inside a backend job is never launched. An operation the kernel created for such a node before the rule existed is settled and blocked with refusal `out-of-repository` on the next ledger sync.

A node that names no repository is claimed by the **side** of the product its layout sits in.
`layoutOf(node)` is the path inside the feature (`implementation/frontend/receipt`) and `layoutSide(node)`
reads the side out of it: `implementation/frontend/**` is frontend work, `implementation/backend/**` is
backend work, every other layout names no side and belongs to both.
`executableCandidates(ledger,{repository,side})` applies the two rules in order — a declared repository
decides on its own; only a node that declares none is filtered by side — and a job that knows no side
(`side:null`) filters by repository alone, exactly as before.

## Shared ledger across repositories

A product has exactly one canonical `.starciwork`, owned by its backend. Its frontend is a different
repository with no Work tree of its own, so a frontend workflow reads and writes the backend's tree.
`execution/ledger-routing.mjs` is the only thing that decides which tree that is:

| order | source | how |
| --- | --- | --- |
| 1 | `option` | `--ledger-root <path>`, naming the tree or the repository that holds it |
| 2 | `workspace` | the host registry `<host>/../.workspaces/projects/<project>/work.json` (`starci/workspace-binding@1`): `repositories` by role, `work.ownerRole` + `work.pathFromRepository` |
| 3 | `local` | `<repoRoot>/.starciwork` — the repository owns its own tree |

`resolveLedgerRoot({repoRoot,host,options,git})` answers
`{ledgerRoot,ownerRepoRoot,ownerRepository,sharedLedger,source,role,ownerRole,side,project,exists}`. A
repository is recognized in the registry by the path its route declares **or** by its actual git origin
(host and path, so `git@host:org/repo` and `https://host/org/repo.git` are one repository) — which is how a
session worktree is recognized too. Two projects claiming one repository, a route with no resolvable
`work.ownerRole`, and a named or routed tree with no `features/` directory are all errors: the only silent
answer is the local one, and `exists:false` there simply means this job has no Work tree and runs the
model-assessed plan ledger instead.

What follows from a shared ledger (`sharedLedger:true`):

- **The record goes to the owner, the code stays here.** Every `state`, `completion`, kernel block and
  evidence manifest is written under the owner's tree and committed in the owner repository, on whatever
  branch it is on, with the same `work(<node>): …` message and `Work: <node id>` trailer. The allowlist,
  the checks and the operation commits belong to the workflow's own worktree, and the workflow head stays
  the head of the code it produced; the ledger commit is reported separately as `ledgerCommit`.
- **Proof names the code, not the ledger.** `markDone(where,node,{repository})` and `writeEvidence` take the
  repository explicitly, so `completion.sourceIdentity` / `codeRefs` and the manifest's
  `provenance.servedVersions` name the repository the slice is in. A tree with completions from several
  repositories validates: direct source identity binds origin and commit itself and needs no repository
  resource in the owner's tree.
- **The owner's working copy is somebody else's.** A workflow on a shared ledger refuses to start when the
  owner has pending changes under the tree that the kernel does not own — anything that is not a node
  `index.yaml`, an `evidence/` file or the `_local` runtime directory (`sharedLedgerStatus`).

`ledgerLocation(where)` is how the path helpers take all of this: every function in this module that took a
repository root still does, and also takes `{repoRoot,workRoot}` — the repository that owns the tree plus
the tree itself.
