---
name: starci-fe-design-apply
description: Materialize one sealed executable StarCi preview candidate across a single or coordinated batch of pages, layouts, blocks or overlays. Inherits Context Lock, reconfirms every production write boundary, verifies candidate hashes and effective StarCi FE lint before edits, forbids redesign or freehand reinterpretation, coordinates non-overlapping worker packets, and requires same-state visual and structural parity before handoff.
---

# StarCi FE Design Apply

Apply materializes one approved executable candidate into its recorded target paths. It does not
translate a picture, finish design work in JSX, or choose a visually similar alternative.

## Context, confirmation and admission

Read [`../../CONTEXT-LOCK.md`](../../CONTEXT-LOCK.md), Plan/Preview records and the approved review
manifest. Redetect context, print lock and drift, persist `context-lock.apply.md/json` with
`status: awaiting-confirmation`, then stop for explicit confirmation of every target repository,
branch, worktree and exact writable boundary. No production edit, dependency change, generator or
worker dispatch occurs before confirmation.

Proceed only when the version-3 design record names one `caseId`, one `approvedRevision`, explicit
user approval, frozen owners/files, complete state classification, every contract/API/backend delta
and a valid seal. Validate it before lint or production work:

```powershell
node <trust-root>/skills/starci-fe-design-preview/scripts/verify_design_record.mjs <design-record.json>
```

A record whose new owners carry no consolidation verdict, or whose open questions were never
answered, is not admissible either. Both are decisions the record is supposed to have settled, and
Apply is the phase with the least standing to settle them: it is holding a write boundary, so the
cheapest thing it can do with an open question is answer it silently in code.

Any missing candidate source, fixture, screenshot, runtime fingerprint or hash blocks Apply. Missing
Plan names `$starci-fe-design-plan`; selected but unapproved work names `$starci-fe-design-preview` —
in each case carrying the finding and the ONE recorded decision it invalidates, per
[`../../handoff.md`](../../handoff.md), so the earlier phase resumes on evidence rather than
rediscovering it. Apply holds the evidence for its own refusal; a refusal announced as a bare route
leaves that evidence in the phase least able to act on it.

## Mandatory lint-adoption gate

Before the first production edit, run the canonical effective-config audit against a real target
production file:

```powershell
node <trust-root>/scripts/audit-fe-lint-adoption.mjs --target <target-repo> --probe <production-file>
```

It must report `ok: true`: every canonical `starci-fe/*` rule resolves to `error` and
`noInlineConfig` is true. A local plugin folder, a similarly named copied plugin, or a partial rule
set is not adoption. If the audit fails, repair lint wiring only when the confirmed write boundary
explicitly includes it; otherwise stop and report missing/weakened rules. Rerun after any lint
change and at handoff.

## Materialize the approved revision

Read [`references/steps-table.md`](references/steps-table.md) and
[`references/parity-gate.md`](references/parity-gate.md), governing canon/design, locked source
anchors, contracts/callers/tests, backend behavior and named legacy evidence. Revalidate drift and
ownership. Pages orchestrate; blocks own product sentences; branches arrange contract content;
shells own vendor mechanics; connected blocks resolve world data and render pure `_X` halves.

Inventory before invention. Before writing a new contract entry, composite or row into the target,
list the existing keys and composites whose shape already expresses the same relationship and record
one verdict per candidate: REUSE, EXTEND, or NEW because <the relationship no existing key can
express>. An entry whose class list and child identities repeat an existing entry is not a new
concept, it is the same concept under a second name, and `starci-fe/no-duplicate-entry-shape` refuses
it. A row assembled inline from a leaf plus a glyph is the same failure where no lint can see it,
because it never became an entry at all. This repository has already paid for it: a value-proposition
list was written with the exact class list of the day's-quest list, and its ticked row was rebuilt
from a text leaf and an icon while the composite that draws that row already shipped.

Map each sealed candidate file to its recorded target path. Reuse imports as recorded; copy or port
candidate source mechanically; make only environment integration edits that the record explicitly
permits in `integrationEdits`. An edit nobody declared before the seal is not an integration edit —
it is a change to an approved artifact made by the phase the approval was meant to bind, so it
returns to Preview for a minor revision rather than being written and explained afterwards. Do not substitute components, contracts, props, token classes, DOM anatomy or fixtures
because another implementation is easier. If target drift prevents exact materialization, do not
adapt the design silently and do not stop at the gate's message either. Resolve what actually drifted
and say which of the three it is: a shared file rewritten under the run is MECHANICAL — resync the
candidate mirror from the clean tree, re-apply the recorded additions and carry on; a component that
no longer exposes the approved slot is a DECISION and joins the form; an asset or endpoint the target
never had is a RESOURCE and ships with the command that supplies it; a capability the target does not
have at all is a SUB-RUN that names its owning skill and returns here. Only drift that invalidates a
recorded decision goes back to Preview, and it goes back carrying the finding rather than announcing
it. Everything in this scope that does not touch the drifted seam is materialized and verified first,
per [`../../handoff.md`](../../handoff.md); one broken seam refuses its own packet, never the phase.

Implement one vertical representative slice first and render the exact approved `stateId`. For API
extensions, preserve owner, semantic slot, default/absence, precedence and existing callers.
Implement backend enablers only when the approved record proves they expose existing authorized
behavior: a read projection, an existing command, or an existing event over authenticated
transport. New invariant, permission, lifecycle, state, event production, infrastructure, payment
or identity behavior requires backend design.

## Coordinator, workers, closer

The coordinator freezes shared core and dependency order, then creates non-overlapping packets with
the spec hash, approved revision/state IDs, exact candidate and target files, forbidden shared files,
commands and return evidence. Workers inherit the confirmed Context Lock and cannot relock, broaden
authority, redesign, add unapproved props/contracts, recreate approved UI from screenshots, or
declare integration complete. The coordinator reads every diff, integrates shared seams and runs
gates. A fresh closer may audit the integrated diff and state matrix, but does not redesign or
silently patch. The coordinator alone accepts completion.

For a small single owner, keep all roles with the coordinator; do not manufacture parallelism.

## Verification and handoff

After editing the contract table, run the target repository's typecheck before rendering anything:
the class vocabulary is a closed union, so one unadmitted token makes the whole table fail to type
and reports as errors in unrelated files.

Verify every approved owner state in browser using the exact recorded route, viewport, locale,
theme, auth persona and fixture hash. Capture production beside its approved screenshot and compare
component/contract tree, DOM anatomy, copy/data, density, grouping, separators, typography, icons
and interaction. Different state is not an explanation for design drift; it is an invalid
comparison. Structural drift has zero tolerance. Unapproved visual drift returns to Preview even
when tests are green.

Before claiming the candidate landed, prove it against the seal rather than against a reading of the
diff:

```powershell
node <trust-root>/skills/starci-fe-design-apply/scripts/verify_apply_materialization.mjs <design-record.json> --target <target-repo>
```

Every recorded target must be present and either identical to its approved hash or listed in
`integrationEdits` with a reason. A missing file, an undeclared difference or a target outside the
confirmed boundary blocks handoff — for the file it names. Report each as its cause rather than as
the mismatch: which file, what rewrote it, and whether clearing it is the run's own work, a decision
or a resource. A hash that moved because another session rewrote a shared import is not the same
finding as a hash that moved because this phase edited an approved artifact, and only the second one
returns to Preview. This checks bytes, never appearance: it cannot see a wrong
hierarchy, so it stands beside the same-state parity matrix and does not replace it.

Run focused tests, typecheck, strict lint, canonical rule tests, production build, design-record
validation, materialization verification and lint-adoption audit. Never suppress a failure or add an
undocumented exception.

Report spec hash, approved revision, candidate-to-target map, same-state browser evidence, parity
result, command ledger, remaining drift and unknowns. Worker completion, green unit tests or a
production screenshot from another state are insufficient.

Apply invites nothing after it, so its close is the item form itself, per
[`../../handoff.md`](../../handoff.md). Sort every remaining line by who can clear it and hand the set
over as ONE pass: what the run already repaired inside its boundary, reported and not asked; each
DECISION with the default in force and the one file that changes if the answer differs; each RESOURCE
with the exact command that supplies it and the check that proves it landed; each SUB-RUN with the
skill that owns it and what it returns here to finish. Name what each line blocks precisely — one
state, one href, one packet — because a line that says only "incomplete" is the same fact with the
act removed, and it is what turns a finished Apply into a case nobody can close.
