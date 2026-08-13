---
name: starci-fe-design-preview
description: Build and refine an executable, production-faithful StarCi UI candidate for one selected direction before implementation. Use after starci-fe-design-plan records one selected direction for a single or batch scope. Inherits Context Lock, writes artifacts only, renders the exact candidate component tree against locked fixtures and runtime states, revises it in place, seals hashes, and records explicit approval of one revision. Never approves a standalone HTML imitation or edits production code.
---

# StarCi FE Design Preview

Preview is the executable revision and approval phase: `1.0 -> 1.1 -> 1.2 -> approved`. It optimizes
one selected direction rather than generating new directions. Its approved output is a frozen
implementation candidate, not an image that Apply later interprets.

## Input and Context Lock

Read [`../../CONTEXT-LOCK.md`](../../CONTEXT-LOCK.md), the Plan context record and the complete
`plan-record.md/json`. Redetect context, print inherited lock plus drift, and stop on any difference
or ambiguity. Persist `context-lock.preview.md/json` in the same artifact root. Preview writes no
production or trust source.

Proceed only when Plan records one `caseId`, one selected direction, explicit selection evidence,
owner boundaries, state inventory, contracts/proposals and business evidence. Return to
`$starci-fe-design-plan` when feedback changes product thesis, ownership, business behavior or
reopens alternatives. A visual refinement or compatible approved prop refinement remains Preview
work and is recorded explicitly.

Read [`references/steps-table.md`](references/steps-table.md),
[`references/state-coverage.md`](references/state-coverage.md),
[`references/executable-spec.md`](references/executable-spec.md), governing canon/design, locked
`starci-academy-fe` source anchors, selected Plan HTML, callers and tests.

## Build the executable candidate

Treat selected Plan HTML as directional evidence only. Build an artifact-local candidate with the
same framework, StarCi leaves/composites/branches/shells, contracts, vendor wrappers and tokens that
production will use. Prefer importing locked target components read-only. When an approved API or
new owner does not exist yet, place its exact proposed source in the candidate and record its future
target path. Do not replace unavailable StarCi components with hand-written HTML/CSS merely to match
the Plan picture.

Inventory before invention. Before writing a new contract entry, composite or row into the candidate,
list the existing keys and composites whose shape already expresses the same relationship and record
one verdict per candidate: REUSE, EXTEND, or NEW because <the relationship no existing key can
express>. An entry whose class list and child identities repeat an existing entry is not a new
concept, it is the same concept under a second name, and `starci-fe/no-duplicate-entry-shape` refuses
it. A row assembled inline from a leaf plus a glyph is the same failure where no lint can see it,
because it never became an entry at all. This repository has already paid for it: a value-proposition
list was written with the exact class list of the day's-quest list, and its ticked row was rebuilt
from a text leaf and an icon while the composite that draws that row already shipped.

Read the canon for every tier you are about to author BEFORE authoring it — `leaf`, `composite`,
`branch`, `block`, `page` — not after. A page that takes one situation prop for the whole screen, a
branch that opens `children`, a component that writes its own layout class: each compiles, renders
and reviews cleanly, and each is refused by canon. Reading the tier afterwards turns the whole
candidate into rework.

The candidate must run, typecheck, PASS THE TARGET'S CANON LINT and expose a manifest of exact
source files and target paths. Capture both runs: `candidate.build` and `candidate.lint` each record
the command, its exit code and a log file that is hashed and sealed with everything else, because a
command named in a field is not a command anybody ran. Lint the candidate as you write it rather
than once at the end — the rules state their own remedy in the message, so they are the cheapest
design review available and the only one that cannot be talked out of a finding. After editing the
contract table, run the target repository's typecheck before rendering anything: the class vocabulary
is a closed union, so one unadmitted token makes the whole table fail to type and reports as errors
in unrelated files.

If the target's ESLint configuration does not reach the candidate path, that is the first defect to
report: the candidate is the source Apply ports into `src/`, so rules scoped to `src/**` alone leave
this phase ungoverned exactly where it decides production.
The render and source panel must consume this candidate; a separately maintained HTML facsimile is
forbidden. If selected anatomy cannot be expressed without a new product or ownership choice,
return to Plan. If it needs only an already-approved compatible API proposal, implement that
proposal inside the artifact candidate and keep it visible for approval.

## Revision model

Create revision `1.0` from the selected direction. Every feedback pass increments only the minor
revision (`1.1`, `1.2`, ...) and records affected elements, retained traits, rejected traits and exact
reason. Do not reset the design or rewrite unrelated regions when the user points at one element.
The current revision remains inspectable beside its feedback ledger.

One case covers the whole single/batch scope. Render one cohesive review scene by default. Complete
state coverage does not require one case per state: expose state controls or integrated scenarios in
that scene and keep a machine-readable state manifest. For every owner state record `rendered`,
`covered-by`, or evidence-backed `not-applicable`. Do not create a Cartesian product.

For every rendered state freeze `stateId`, route, viewport, locale, theme, auth persona, fixture file
and hash, owner/component tree, contract keys, props/actions, token decisions and screenshot. Never
compare visitor Preview with owner production or loading Preview with populated production. Show
owner/block trees, contract keys and `why`, reuse/API/new-owner widgets, and bounded backend
proposals. Skeleton only genuinely pending values; known labels, totals and unaffected owners remain
truthful.

## Host and revise

Use [`assets/review-lab/`](assets/review-lab/) only as review chrome around the executable candidate;
set its manifest `phase` to `preview` and point each rendered state at the candidate runtime through
`candidateUrl`. The chrome loads that runtime in an iframe and lists its exact candidate file map.
It must not receive `state.html` or a second CSS implementation. Host the candidate on the first
free port from `8080`:

```powershell
python <trust-root>/skills/starci-fe-design-preview/scripts/serve_preview.py <preview-directory> --start-port 8080
```

Report path, URL, PID and stop command. After each feedback pass, update the revision and return the
same review URL. Ask for explicit approval of a named revision; silence and agent completion are not
approval.

When approval arrives as "ok", "looks good" or a nod at the screen, do not seal it as though the
revision had been named. Name the revision back once — "approve revision 1.3 as shown?" — and record
the answer as `confirmed-restated`, with the restatement and the user's own words kept in separate
fields. A bare confirmation approves a specific thing only if that thing was stated first, and the
record has to show which of the two happened.

## Settle the candidate before sealing

A revision is approved by looking at it, and looking is blind to three whole classes of defect: a
seam that separates the wrong level of grouping, a decision the user never knew was made, and a
component rebuilt beside the one that already draws it. None of the three is visible in a rendered
state, and all three survive any number of revisions. So the candidate carries three short records
into approval, and the seal refuses a candidate missing any of them.

**The relationship sheet.** For each candidate: every seam and the level of grouping it separates,
every text node and its rank, every control and its variant with the reason. The reader approves
these WITH the pixels, because a relationship stated in a line can be refused in a line, while the
same disagreement expressed as a picture has to be redrawn before it can even be argued with.

**The open questions.** Every product decision the candidate had to settle that no rule decides —
whether page furniture stays when the data would hide it, whether an action is words or a glyph,
what a control is called. State each in one line with the default taken and what it costs, at most a
handful. Silence on the list is not agreement with it; approval names them or waives them out loud.
A decision the reader finds AFTER implementation was never theirs to make.

**The consolidation verdicts.** List every new owner the candidate introduces — leaf, entry,
composite, block — with its nearest existing kin found by vendor primitive, class signature, slot
identity and domain entity. Settle each with the three tests and the four verdicts already owned by
[`starci-fe-consolidate-plan`](../starci-fe-consolidate-plan/SKILL.md): `merge`, `prop-variant`,
`extract-composite` or `keep-apart`. Do not restate those tests here; a second copy of a rule is the
duplication this section exists to catch.

`keep-apart` must NAME the fact that distinguishes the pair — a different vendor primitive, a
different slot identity, a different domain entity. A pair kept apart on the grounds that they feel
different is a pair nobody compared. Two things that render identically may still be two things:
words that press are a link primitive with focus, keyboard and press semantics, and words that do
not are a line of copy — which is why "renders the same" is the weakest signal on this list and
never the verdict on its own.

The scope is the candidate's own new surface and each new owner's nearest kin. A survey of the whole
tree is [`starci-fe-consolidate-plan`](../starci-fe-consolidate-plan/SKILL.md)'s job, and running it
on every revision is how a phase stops being run at all.

**Named references only.** When — and only when — the request names a legacy or production screen,
read that screen's SOURCE and list the divergences with their reasons before approval. An unnamed
reference is not consulted and not guessed at.

## Freeze approval

Write version-3 `design-record.md/json` using
[`references/design-record.md`](references/design-record.md). Record `approvedRevision`, revision
history, complete owner-state classification, exact candidate files/target paths, state runtime
fingerprints, fixtures, screenshots, trees, contracts, props, tokens, API proposals and approved
additive backend enablers, plus the relationship sheet, the answered open questions and one
consolidation verdict per new owner. After explicit approval, seal hashes:

```powershell
node <trust-root>/skills/starci-fe-design-preview/scripts/verify_design_record.mjs <design-record.json> --seal
node <trust-root>/skills/starci-fe-design-preview/scripts/verify_design_record.mjs <design-record.json>
```

Any candidate, fixture, screenshot or semantic manifest change after approval invalidates the seal
and requires a new minor revision plus approval. Route only a valid sealed record to
`$starci-fe-design-apply`.
