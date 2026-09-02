# Context for `quality.verify`

## Purpose

Context is the exact material this operator may read before a single gate command runs. It answers
"what was delivered, on which head, and which gates were declared for it?" Context never expands the
verification scope and never turns a narrated claim into a measurement.

Every reference is immutable for the invocation and bound by a `sha256:` fingerprint. Source-backed
observations additionally bind the observed source head.

## Context classes

| Context | Role in the decision | Authority status |
| --- | --- | --- |
| Predecessor receipts | The upstream receipts that produced this delivery, consumed unchanged. | Required. Fixes the head every gate runs against. |
| Gate configuration | The pinned command, configuration, and toolchain identity per gate. | Required. Decides what "the same gate" means across runs. |
| Source | The routed checkout and its head. | Required evidence. The subject every gate measures. |
| Knowledge | The recorded source-gate and readiness law. | Reusable law. Never a substitute for a measurement. |
| Approved debt | Owner-approved records that permit a named gate to stay red. | Required to carry a debt at all. |

## Required context

Every invocation requires:

1. at least one predecessor receipt;
2. one gate configuration reference per planned gate;
3. the routed source reference whose head equals `input.project.sourceHead`.

## Refs

| Alias | Resolves to | Bind | Required |
| --- | --- | --- | --- |
| `@dynamic/<receiptType>.json` | `<Source>/.worktrees/sessions/<sessionId>/steps/<n>.<operator.id>/<file>. Writing: <n>.<operator.id> is the current step, and input.project.artifactRootRef must equal that folder. Reading: the nearest earlier step of the same session that wrote <file>; @dynamic/steps/<n>/<file> names a specific step. The session folder is created by the orchestrator and deleted when the run completes; a blocked run keeps it for resume` | fingerprint per file; every file written is registered in output.artifactRefs | Required · dynamic: The producer's receipt; fixes the head every gate runs against. |
| `@workspaces/<project>/<role>/gates` | `<checkout:project/role>  (any routed checkout named explicitly, for cross-project reads: @workspaces/nivo/fe)` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | Required · static: The pinned gate commands and configuration. |
| `@workspaces/fe` | `<checkout:input.project.id/fe>  (diskPath from <Source>/.workspaces/local/routes/<project>/fe/config.json); friendly segments: /husky, /package, /gates, /grammar (see segments)` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | Required · static: The subject every gate measures when the verified boundary is a frontend. |
| `@workspaces/be` | `<checkout:input.project.id/be>  (diskPath from <Source>/.workspaces/local/routes/<project>/be/config.json); friendly segments: /husky, /package, /gates (see segments)` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | Required · static: The subject every gate measures when the verified boundary is a backend. |
| `@worktrees/debts` | `<Source>/.worktrees/debts/  (be.md, fe.md, per-item files)` | fingerprint per file | Optional · static: Owner-approved debts a red gate may carry. |
| `@dynamic/quality-verification.json` | `<Source>/.worktrees/sessions/<sessionId>/steps/<n>.<operator.id>/<file>. Writing: <n>.<operator.id> is the current step, and input.project.artifactRootRef must equal that folder. Reading: the nearest earlier step of the same session that wrote <file>; @dynamic/steps/<n>/<file> names a specific step. The session folder is created by the orchestrator and deleted when the run completes; a blocked run keeps it for resume` | fingerprint per file; every file written is registered in output.artifactRefs | Required · dynamic: This step's own receipt, and beside it every artifact the Sequence names; the folder input.project.artifactRootRef must equal. |
| `@dynamic/changes.md` | `<Source>/.worktrees/sessions/<sessionId>/steps/<n>.<operator.id>/<file>. Writing: <n>.<operator.id> is the current step, and input.project.artifactRootRef must equal that folder. Reading: the nearest earlier step of the same session that wrote <file>; @dynamic/steps/<n>/<file> names a specific step. The session folder is created by the orchestrator and deleted when the run completes; a blocked run keeps it for resume` | fingerprint per file; every file written is registered in output.artifactRefs | Required · dynamic: The producer's changes.md: which paths moved, which gates and surfaces it names. |

## The predecessor is consumed, not re-derived

`context.predecessors` arrives with each receipt's reference, type, fingerprint, and observed head.
Every predecessor head must equal every other and must equal `input.project.sourceHead`.

Two predecessors on different heads describe two different deliveries, and gating the union of them
measures something nobody built. That is `PREDECESSOR_MIXED`, and it is rejected at input rather than
discovered as a confusing gate failure later. A predecessor whose fingerprint no longer matches the
frozen source is `PREDECESSOR_STALE`.

This operator never re-derives what a predecessor decided. It does not re-plan the delivery, re-open
its boundary, or form an opinion about whether the change was a good one.

## Verification only

Quality measures. It does not repair, redesign, reclassify, or negotiate.

A failing gate produces a red receipt naming the failure and its classification, and the receipt is
returned to the owner who can fix it. The operator does not touch product source, does not adjust a
gate command or configuration to change an outcome, and does not rerun a failure hoping for a
different answer. A rerun exists only to classify a contradiction as `flaky` under the declared
policy; it never converts an unexplained failure into green.

Because the operator writes nothing but gate evidence, `artifactRefs` is exactly the set of evidence
references the results name. Anything else appearing there is a write this operator was not allowed to
make.

## Two facts about this codebase

**Sonar measures new code only.** The pinned quality gate is scoped to the new code in the change, so
a green Sonar gate is a statement about the diff and not about the project. A project can sit red
beneath a green gate. When the Sonar scope is `new-code`, a passing result must be recorded together
with a `SONAR_NEW_CODE_ONLY` finding, so nobody later reads the receipt as project health.

**End-to-end is never run unless explicitly requested.** The e2e suite runs only when the caller asked
for it in this invocation. Planning the gate without that request is invalid input. Recording it as
`skipped-not-requested` is the honest result, and it carries an `E2E_NOT_REQUESTED` finding so the
absence is visible rather than inferred from a missing row.

## Debt is explicit and owned

A gate may stay red only when an owner-approved debt record covers it, naming the debt, the gate, the
approval, the owner, and the expiry. An expired approval is not a debt, and a debt against a gate that
passed is a record of nothing. Both are rejected.

A debt covers only an `in-boundary` failure, the kind the delivery owner can fix. A `boundary-drift`
failure belongs to whoever owns the boundary and cannot be owed away here.

## Boundary

Context is read-only. The operator writes gate evidence and the receipt under
`input.project.artifactRootRef`, and nothing else anywhere.

## Resources

This operator runs end to end on the `sonnet` profile (`claude-sonnet-5`, runtime `claude`), declared under `resources` in `operator.json` and validated by `scripts/validate-resources.mjs`. Grants it requires: none. It never searches the web, is not bound to Grammar, and generates no image. A grant absent from `requires` is unavailable even if the profile would permit it.
