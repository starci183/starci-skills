# Deterministic source staleness check

`scripts/checks/check-stales.mjs` is the read-only source/record/stack
freshness gate. It reads an existing canonical `.starciwork` tree, runs the
canonical validator, selects the declared inspection closure, and compares
current `inputDigest`, completion evidence, `sourceRefs`, and
`starci/source-identity@1` coverage with explicitly mapped Git repositories.

```sh
node scripts/checks/check-stales.mjs --work <work-root> \
  --repo <repository-id>=<git-root> [--repo ...] \
  [--target <exact-work-node-id> ...]
```

Every repository named by a selected source binding must have an explicit
`--repo` mapping. A mapping is an observation boundary, not permission to edit
it. Omit `--target` to inspect all canonical nodes. With targets, the scanner
includes aggregate descendants, ancestor context, `dependsOn`, `refs`, split
SRS/SDS semantic inputs and applicable brand context. Ancestors do not by
themselves select unrelated siblings. Unrelated Git changes do not invalidate
unchanged scoped source coverage.

The command prints `starci/source-staleness-report@1` JSON. Output has no
clock value, and stable inputs produce byte-identical output and finding IDs.
It exits:

- `0` only when every selected subject is `verified-conforming` within its declared coverage;
- `1` for `revalidation-needed`, `known-drift`, `missing`, or `unverifiable` findings;
- `2` for invalid arguments, unsafe/protected paths, missing roots, unknown targets, or unresolved repository inputs;
- `3` for an unexpected internal failure.

## Meaning of a result

The scanner derives status; input files cannot author it.

- `verified-conforming` means the canonical validator accepts the selected record and current bytes match its declared source coverage. It is bounded structural freshness, not a new product acceptance claim.
- `revalidation-needed` means semantic inputs, tested source coverage, or evidence bindings changed. A hash difference alone does not prove code wrong.
- `known-drift` means a declared record/specification constraint is currently contradicted.
- `missing` means a required declared source path or completion proof is absent. `IMPLEMENTATION_PROOF_MISSING` does not assert that implementation code is absent.
- `unverifiable` means a repository, revision, snapshot comparison, path, or canonical input cannot be resolved safely. Unknown is never treated as fresh.

Findings keep `source-drift`, `stack-drift`, `contract-drift`,
`evidence-invalid`, and `input-unavailable` separate. Each finding names the
exact subject, references one deduplicated `impactGraph.impactSets` closure,
gives its existing operator route, and returns bounded candidate paths with
`authorized:false`. The graph keeps typed reasons once instead of repeating
transitive edge paths in every finding, so a large record tree remains
machine-readable. The report's `coverage` and `limitations` state the exact
selected closure, stored binding types, and static-only proof boundary. The
report never grants writes, changes records, reopens nodes, rewrites SRS/SDS
from current source, or replaces historical receipts.

Committed `source-identity@1` coverage is compared to its stored revision and
normalized credential-free Git origin. A newer HEAD is still conforming when
the declared scoped paths have identical bytes; unrelated Git commits and
unrelated dirty paths do not invalidate scoped proof. Changed covered bytes
require revalidation. Dirty identities remain `unverifiable` because the
canonical identity preserves an evidence asset and digest but does not define
a reversible checkout format for every snapshot. Earlier `codeRefs` identify a
commit but not covered paths, so they remain explicitly unverifiable rather
than receiving a full-tree assumption.

SRS and SDS remain source-independent. Their current input digests may
invalidate dependent completion or evidence, while source paths and symbols
stay in implementation mappings. `.starciwork/runtime.sqlite`, `.git`, and
`.stacks/staging` are never scanning targets.

## Operation use

A source-staleness audit runs this command before repair and stores its exact
report as evidence. The selected closure includes exact targets, aggregate
descendants, ancestor context, ordinary `dependsOn`/`refs`, split SRS/SDS
semantic inputs and implicit brand input where applicable. Existing ops own
any later bounded repair — `business.decide`, `architecture.decide`,
`backend.implement`, `interface.implement`, or `runtime.operate`
(`modules/ops/ops/<id>.yaml`). The repair op must compare accepted SRS/SDS
with source and preserve prior completion/evidence history; it cannot promote
current code into a requirement. A separate verify op reruns this command
after the repair and rejects any remaining or newly introduced finding. An
implementation leaf with no completion reports missing proof; it does not
claim source code is absent. A stored but stale completion reports
revalidation instead of being relabeled as missing implementation.

The stale subject itself may be the audit target; it is not scheduled as a
completed prerequisite merely to inspect it. Real upstream authorization and
declared dependencies still apply. `baselineDigest` binds the canonical
inputs and stored source identities scanned by this report. It is not an
acceptance receipt and cannot bless current bytes automatically.

## Settled jobs and changed runtime inputs

`api dispatch` records, on the contract row, the digest of every input the
op binds, split in two kinds (`scripts/kernel/input-digests.mjs`):

- **Source law** (`kind: source`): every `knowledge/**` and
  `modules/schemas/**` path (and `modules/models/code-patterns.yaml`) the op
  manifest reads or the packet cites — a directory or glob as the digest of
  its sorted file digests, a missing path as `absent`. A settled job is judged
  against the Source it was **admitted** under. A later knowledge or schema
  edit is `sourceDrift` in `api survey`/`api status` (and
  `status.frontier.sourceDrift` per path): advisory, never stale, never
  actionable. It names the contract changes registered after the job's
  admission whose `paths` cover the edit
  (`modules/kernel/contract-changes.yaml`), or marks it `unregistered`. Work
  that must catch up with an edit is a change registered `reach: follow-up`:
  status lists its owed legs as `contractFollowUps`.
- **Product Work** (`kind: work`): the `.starciwork/**` records of the job's
  `payload.records` (a record directory counts its `index.yaml` /
  `resource.yaml` files, never `evidence/` or `assets/`). `api settle`
  re-baselines them to the bytes the job left, with a per-file map. `api
  survey`/`api status` list a settled job (passed, or partial) as
  `staleInput` when a record file changed since, unless the change lies in the
  owned paths of the job itself or of another job of its workflow still open
  or settled after it — the workflow's own later legs writing what they own is
  planned progress. `status.frontier.staleOperations` makes the frontier
  actionable; the Kernel redoes such a job as a new attempt of the same op and
  cut ordinal, a cut seam-first (`modules/kernel/driver-loop.yaml`
  `enqueue.cutExecution`); until then its result does not satisfy its leg.

A contract recorded without digests, or an entry recorded before kinds existed
(classified by its path), never reports Work staleness it has no settle
baseline for; every earlier `knowledge/**` entry is Source and therefore
advisory.
