---
name: starci-fe-design-plan
description: Present evidence-backed StarCi UI choices for net-new or genuinely undecided frontend work across one or many pages, layouts, blocks or overlays. Use when product hierarchy, CTA, interaction, disclosure or reusable vocabulary still needs a user choice. Locks context, writes artifacts only, renders one cohesive comparison case as real HTML from port 8080+, and stops for explicit direction selection. Do not use for a bounded fidelity fix with a known reference and no product choice.
---

# StarCi FE Design Plan

Turn uncertain product intent into visible choices without inventing business truth. Canon is fixed
grammar. Backend behavior is business evidence. Contract `why` and concrete
`starci-academy-fe` source anchors are reuse evidence. A named legacy render is the parity baseline.

## Admission and Context Lock

Read [`../../CONTEXT-LOCK.md`](../../CONTEXT-LOCK.md), detect workspace/repository roles and print the
Context Lock table. Stop on any ambiguity. Persist `context-lock.plan.md/json` in the locked artifact
root. Plan may write only artifacts; target source, reference repositories and trust remain read-only.

Use Plan only when at least one real choice remains. Route an exact, bounded parity or runtime repair
with a known target to `$starci-fe-fidelity-fix`. Do not manufacture options around a settled fix.

Read [`references/steps-table.md`](references/steps-table.md),
[`../../fe/creativity/INDEX.md`](../../fe/creativity/INDEX.md), governing canon/design, relevant
contracts and their `why`, concrete source anchors at the locked reference HEAD, callers, tests,
rendered evidence, and backend truth. Read
[`references/backend-enablers.md`](references/backend-enablers.md) only when a UI need may require a
small additive backend enabler.

## One scope case, several selectable directions

One run creates exactly one cohesive case for the requested scope. The case may contain one block,
several pages, a persistent layout and overlays; `batch` describes delivery, never ownership. Freeze
one work-item matrix and dependency graph, with one primary scope (`page`, `layout`, `block`, or
`overlay`) per item.

Inside that case, produce two to four genuinely distinct directions. Directions vary product
decisions—CTA priority, reading order, disclosure, density, interaction or composition—not colour
swaps. Migration and mixed work include a parity-first direction and label every divergence. A
multi-page batch still receives one direction system, not unrelated options per page.

Each direction records:

1. thesis, primary CTA, success condition and reading order;
2. evidence, assumptions, unknowns and legacy divergence;
3. owner/block tree and contract graph;
4. required owner-state inventory;
5. reuse, public API extension and new-owner proposals;
6. bounded backend-enabler proposals, if any;
7. strongest benefit, trade-off and adversarial rejection risk.

An existing component may gain a prop only when it already owns that semantic relationship and
visual slot. Record exact `props`/`on` delta, absence/default, precedence, callers and tests. Do not
rename a domain fact into a generic-looking but false prop to avoid creating the correct owner.

## Direction lab

Read [`references/direction-lab.md`](references/direction-lab.md). Build one real-HTML comparison
lab for the case, with one representative scene per direction. The scene is sufficient to judge
hierarchy, CTA, reading order, density, owner tree, contracts and proposals; Plan does not expand
every state into a separate page. Keep the complete state manifest explicit for Preview.

Every Plan canvas must visibly say `DIRECTIONAL - NOT AN APPLY BASELINE`. Plan HTML is a choice
instrument, not an implementation promise. Never call it production parity, approved fidelity or an
Apply-ready render. A direction is selectable only when its proposed anatomy is demonstrably
expressible by current StarCi owners/contracts or by exact API/new-owner proposals recorded beside
it. An attractive shape with no feasible component path is not a valid direction.

Host on the first free port from `8080`:

```powershell
python <trust-root>/skills/starci-fe-design-preview/scripts/serve_preview.py <direction-lab-directory> --start-port 8080
```

Report absolute path, URL, PID and stop command. Show a compact comparison table in conversation,
give the URL, then stop for an explicit direction choice. Do not select for the user. A requested
hybrid becomes one updated direction with retained and rejected traits named and its HTML refreshed.

When the answer is not one of the directions — "either is fine", "whichever is fastest", silence —
ask once more as a binary question. If it stays ambiguous, do not keep waiting and do not choose on
merit: fall to the direction that risks least, `parity-first` where a baseline exists and
`conservative` otherwise, record `selectionKind: default-after-ambiguity` with what was asked and
what came back, and say plainly in conversation that this was a default rather than a selection. A
default is reversible in Preview; a decision the user never made, recorded as though they made it,
is not.

## Record and handoff

After selection, write `plan-record.md/json` using
[`references/plan-record.md`](references/plan-record.md), status `direction-selected`, exactly one
`caseId`, and exactly one `selectedDirectionId`. Validate it before routing:

```powershell
node <trust-root>/skills/starci-fe-design-plan/scripts/verify_plan_record.mjs <plan-record.json>
```

It must report `ok: true`. Route to `$starci-fe-design-preview`. Plan never
claims visual approval, executable parity or edits production code. Preview must rebuild the
selected direction as an executable candidate; it must not bless the Plan mockup by copying it.

When agents are available, they may inventory independent evidence or critique bounded directions.
The coordinator owns Context Lock, business thesis, CTA, shared layout, contracts, vocabulary,
backend-enabler classification, synthesis and the stop for selection. Agent agreement is not user
selection.
