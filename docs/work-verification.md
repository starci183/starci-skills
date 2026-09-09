# Useful verification and dependency repair

`.starciwork` is a tree of owned, typed contracts, not a collection of audit forms.
Its folders organize scope; stable IDs, typed design imports, `refs` and
`dependsOn` form a graph that can cross folders and module boundaries. Shared
design has one owner. Parent nodes aggregate current required children, rather
than declaring a separate manual completion.

## What earns completion

Use each layer's supported schema and verification profile. The common question
is whether the actual result satisfies its current inputs and acceptance, with
enough specific support for another reviewer to judge it.

| Layer | Meaning of the result and its support |
| --- | --- |
| Business/SRS | Reviewed authorized outcomes, complete relevant flows and rules, consistent acceptance; not passing code tests. |
| Architecture/SDS | Reviewed mechanisms, ownership, connections and significant failure paths realizing SRS and shared contracts; not proof of deployed behavior. |
| UI | Reviewed screens, states and interactions covering the selected journeys and Grammar; design pictures are not screenshots of working code. |
| Implementation | Actual behavior delivered, meaningful design-to-code boundaries, exact source identity and checks performed, with explicit remaining gaps. |
| UAT | Current SRS outcomes compared with observed behavior of an identified running build/environment, including usable captures where needed. |

Examples illustrate the judgment, not compulsory fields for every node. Use
current typed fields; a prose example does not authorize invented schema keys.
Business/SDS record current review inside `completion.review`. Implementation,
E2E and UAT can retain useful evidence through their existing supported profiles.
Do not create an evidence directory just to copy a specification into it, or
delete actual test output, screenshots or videos to satisfy a naming preference.

## Identify what was actually checked

For committed source, bind the exact repository and revision. Explain what was
delivered and why it matters; do not repeat the Git changed-file inventory.
Optional source anchors are useful only when they clarify a non-obvious boundary
or a particular gap. Planned work must not masquerade as implemented behavior.

A commit alone is not a test result. A test on a dirty working tree is not a test
of HEAD: retain a reproducible identity of the tested changes with the result, or
rerun on the final identified revision. Never label an unrecorded dirty run as
current final verification. Similarly, a UAT URL alone does not identify the
served artifact; connect the observed build to the implementation being accepted.
If that connection is unverified, say so and do not use the run to accept that
implementation. Separate source identity, execution context and observed result.

Record checks proportionately: what criterion they exercise, expected versus
actual outcome, the tested subject, and important limits/doubles. Preserve raw
results or media where they materially support the claim. Report pass, fail,
skipped, not-run and inconclusive distinctly; a required skipped or unverified
criterion cannot become pass. A useful bounded unit test is not full integration,
and a simulated provider is not a live provider result.

For visual outputs, identify AI-generated `interface.draw` designs separately
from screenshots captured from the actual product. Record the real environment;
do not label a local/staging capture as production, or use a production baseline
image as proof of a new implementation. A design and a runtime capture answer
different questions even when they look identical.

Do not force all this into every node or add a parallel manifest registry. Use
the owning implementation/UAT record and its supported verification artifacts;
extend a typed contract only when a real result cannot be represented honestly.
Never put credentials or real customer data into audit records or captures.

For evidence bundles, use [scoped publication](scoped-evidence-publication.md)
to preview and publish a new sealed result against its actual owner/input scope.
Unrelated recoverable stale diagnostics remain visible as `globalOk: false`;
publication neither accepts a workflow nor marks its nodes done.

## Repair the failing link, then affected consumers

1. Trace a discrepancy to its owner: requirement, design, implementation, test
   expectation/fixture, or environment. Passing a schema does not settle that.
2. Repair the owning current contract within authority. An existing done is not
   an edit lock. New business policy still requires its actual decision maker.
3. Follow declared dependencies and typed imports to find affected consumers.
   `refs` propagate semantic change but do not impose execution order;
   `dependsOn` expresses prerequisites that must currently be done. Include
   genuine shared imports, not every nearby folder.
4. Review or rerun appropriate checks and bind completion to current inputs.
   Inspect `effectiveState`; a retained stored done on stale inputs is not done.
   Preserve unrelated completed branches and useful prior results without
   presenting them as proof for the changed version.

Hashes detect changes to declared inputs, not missing edges or wrong semantics.
Review the dependency graph as well as its digests. Schema validation establishes
structure and consistency; substantive review and actual execution establish
whether the claimed result is true. Neither substitutes for the other.

## Authoring a design without freezing its own output

An authorized Business, Architecture or interface-draw cell can opt into this
policy on its concrete goal **before presentation and dispatch**:

```yaml
workPolicy:
  schema: starci/authored-work@1
  targets: [example.design.leaf]
  assetWrites: # optional; exact paths, not an asset-directory permission
    - nodeId: example.design.leaf
      path: assets/desktop.png
```

The targets must exactly match that cell's existing selected Work leaves. Each
leaf and each declared writable asset also needs its exact canonical file path
in a goal resource effect or source impact. A new asset need not exist before
dispatch; its existing ancestors must be safe. Other existing assets remain
immutable inputs. Declaring or changing an unapproved asset fails. Images remain
bound by their actual bytes, including after result acceptance.

This emits `starci/cell-request@2`. Core hashes the immutable input graph while
masking only the selected authored leaf content. Workspace/ancestor content,
external inputs, leaf identity, paths, kind, assertions and dependency/reference
edges remain frozen. This narrow authoring mode does not create leaves, change
their graph or invent acceptance assertions. Select and review necessary scope
changes separately before authoring; do not remove a dependency to clear a gate.

`acceptCell` derives `response.workResult` from the actual resulting Work and
includes it in the result digest. Workers cannot supply that seal themselves.
Original request bindings remain unchanged for audit. Approval, completion and
producer consumption verify the sealed current outputs; changed output bytes
or invalidated required inputs require review again. Operational activity and
legitimate completion metadata do not change semantic output identity.

Keep the selected canonical node path in the typed design output, not in the
response's raw-byte `artifacts` list. The runtime already binds that authored
Work through `workResult`; `markWorkDone` legitimately rewrites its completion
metadata. Use immutable review/check artifacts for criterion evidence instead of
hashing the mutable node file or copying the specification into another snapshot.
Raw artifacts such as images, videos, logs and review documents remain byte-bound.
The lifecycle rejects a selected authored node used as a raw artifact before
acceptance, including an alias resolving to that same file.

If a historical accepted response used that invalid pattern and its byte proof is
now stale, preserve its receipts and valid current Work. Do not rewrite the old
artifact hash, exempt it from integrity checks or repeat product effects. Obtain
a fresh bounded current-result review under the actual approval protocol, with
semantic Work outputs and immutable review artifacts, before downstream reuse.

Legacy `cell-request@1` retains its strict original input comparison. Never add
the policy to an existing request or replace its hashes retrospectively. Preserve
that historical attempt and present a fresh bounded review checkpoint against
current content under actual authority. Loading old or stale runs is inspection,
not a statement that their results may advance.

Completion preflight reports `ok` for the exact selected completion scope and
`globalOk` for the entire Work. `remainingErrors` preserves unrelated recoverable
stale-review diagnostics. Structural errors still fail. Necessary external
design inputs and intermediary imports must have current review: masking an
authored upstream change does not renew a stale unselected consumer's acceptance.
Completing upstream repair never completes those downstream nodes automatically.
These hashes protect declared scope and change detection, not human truth or
OS-level prevention of writes outside the declared scope.

## Backend handoff: current producer proof, not an accepted label

An API-dependent frontend consumer must receive the real backend lifecycle run.
Manual user approval, explicit auto delegation and scoped coordinator approval
use the same authority-independent producer verification: frozen goal/Plan and
bindings; every dispatched cell and consumed input; closed typed outputs;
distinct passing criteria including unit and backend E2E; actual unchanged
artifact bytes; current Work inputs and required dependency/reference review.
API conformance needs its own passing `api-contract-pass` criterion; a nonempty
API description is not that check. API-dependent frontend jobs recheck the same
backend producer before every cell effect, when accepting cells/results, at
completion and during later reuse—not just when presenting the frontend goal.
Each mode then checks its own approval records. A malformed auto or coordinator
record cannot fall back to a user-shaped receipt. Do not repair old history by
inventing approvals, hashes or missing requests.

An accepted result may precede marking its selected leaf done. A run claiming
`done` additionally needs current effective completion for those exact leaves:
removed completion, stale manifests or reopened required design inputs block
handoff even when their semantic content hash did not change. Unrelated
recoverable stale review remains visible without invalidating a current scoped
producer; structural Work errors still block. This does not compare an old
pre-edit source anchor with its expected newly implemented bytes.
An aggregate prerequisite needs its required children current, not every
optional future branch. An optional leaf explicitly consumed by a dependency
or reference still needs current review. Optional content stays hash-bound;
this readiness distinction never removes it from semantic change detection.

Historical runs remain loadable for inspection. Loading is not validation for
reuse. Revoking/closing a mandate or expiring an auto budget stops new effects;
it does not retroactively falsify a previously accepted result whose proof is
still current. The consumer needs its own current execution authority. Local
receipt consistency is auditable provenance, not authenticated human identity.

## Aggregate prerequisites inside one workflow

Keep a truthful aggregate dependency such as UAT depending on implementation.
Before a successor cell runs, the runtime verifies prior accepted cell results
again and derives temporary readiness through the aggregate's required children.
Each required leaf must either be currently effectively done or be the exact
target of an earlier accepted, still-current cell in this same run. The aggregate
is not itself a substitute receipt. Missing required siblings, invalid graph,
reopened or suspended Work, stale artifacts and unavailable prerequisites block
progress. An optional child is not required unless separately consumed by an
explicit dependency. References retain their content-binding semantics; they
do not become new execution-order edges.

This calculation does not write done, change Work hashes, remove dependencies
or accept future cells. The same currentness checks apply when accepting a cell
and reviewing the complete result. Work remains todo until the complete accepted
workflow passes normal completion preflight; parents then derive their state.
