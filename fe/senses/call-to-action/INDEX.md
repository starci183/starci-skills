---
id: fe-senses-call-to-action-index
title: INDEX.md
slug: /fe/senses/call-to-action
sidebar_label: call-to-action
sidebar_position: 0
description: Compile a surface job and user state into the closed StarCi Academy action tree.
template: design-canon-v1
---

# INDEX.md

Version: `1.03`

Business tests: [prompt.md](prompt.md) · Vietnamese guide: [vi.md](vi.md) · UI examples: [example.md](example.md)  
Governance: [audit.md](audit.md) · version history: [changelog.md](changelog.md)

## Canon Question

**Given this surface job and user state, what is the one recommended outcome and how is every other
path classified?**

Compile business intent into a complete StarCi Academy action tree: role, product component, variant,
size, label, destination and state. Do not start from button colour.

## Required Business Facts

```text
surface_job: what the user is here to complete
state: ready | pending | success | empty | failed | destructive-confirmation | read-only
eligible_outcomes: concrete destinations the user can reach now
recommendation: none | one outcome | equal alternatives
placement: embedded | standalone | toolbar | navigation | persistent-mobile
reversibility: reversible | destructive
value_evidence: what the user already understands before the ask
```

If surface job, reachable destination, recommendation or placement is missing, return
`INSUFFICIENT CONTEXT`.

## Closed Output

| Action role | StarCi output | Required business meaning |
|---|---|---|
| recommended outcome | `Button` `primary`; `md` standalone or `sm` embedded/persistent | Exactly one action the surface recommends now |
| subordinate available path | `Button` `secondary`; size from placement | Useful path below the recommendation, including settled recovery/empty action |
| equal alternative | `Button` `outline`; size from placement | Alternative taken instead of the main route, not a lesser recommendation |
| low-emphasis optional action | `Button` `tertiary`; size from placement | Optional path whose absence would not block the surface job |
| navigation/furniture/back | `Button` `ghost` or `TextLink`; normally `sm` when embedded | Leaves/navigates/operates furniture without claiming the action anchor |
| destructive action | `ConfirmButton` with explicit `label` and `confirmLabel` | Two-step product control; no invented danger variant |
| no primary ask | Quiet path onward only | Reading/read-only/informational surface has no recommendation |
| unresolved | `INSUFFICIENT CONTEXT` | More than one recommendation or missing job/destination/placement |

`Button` has the closed variants `primary | secondary | tertiary | outline | ghost` and sizes
`sm | md`. CTA canon MUST NOT emit `danger`, custom padding, `lg`, or a visual-only variant.

## Classification Gate

1. Name the surface job and current state.
2. Remove outcomes the user cannot reach now because of permission, missing data or pending state.
3. If product evidence recommends one outcome, assign exactly one `primary`.
4. If alternatives are genuinely equal, do not invent a primary; use `outline` peers or a choice
   control whose selected state is not confused with CTA priority.
5. Classify remaining paths:
   - useful subordinate path → `secondary`;
   - optional low-emphasis action → `tertiary`;
   - back/navigation/furniture → `ghost` or `TextLink`;
   - destructive → `ConfirmButton`.
6. Select size from placement: embedded/persistent row → `sm`; standalone action line → `md`.
7. Label the user-visible outcome/destination. Do not label internal mechanism.
8. Preserve the same promise in pending/failure/success states and keep a path onward.
9. If any two action trees remain valid, return `INSUFFICIENT CONTEXT`.

## Output Explanations

### Primary is a recommendation

`primary` means the surface has one honest main action. It does not mean “important-looking”. Course
pricing can recommend checkout while cart, trial and price detail remain other roles.

### Outline is not secondary

`outline` is an alternative the user may take instead of the main route—OAuth providers beside a
form or an unselected answer/mode. A filled `secondary` reads as subordinate, not equal.

### Size comes from placement

The same recommended outcome is `md` in a standalone pricing rail and `sm` in the pinned mobile
enrol bar. Priority did not change; geometry owner did.

### Destructive behavior is a component

StarCi has no `danger` Button variant. `ConfirmButton` arms on first press, exposes the explicit
destructive result, expires its armed window and acts on the second press.

## Exceptions and Safe Stops

- Retry may become `primary` only when it is the one viable restoration of the blocked core flow.
  Generic empty-state retry uses the product's `secondary sm` `EmptyNotice` path.
- Selected-state controls may use `primary`/`outline`; that is selection semantics, not evidence that
  the surface has multiple CTAs.
- A surface may have no primary ask, but it MUST expose a quiet onward/back path when the user can
  leave it.
- Persistent mobile CTA requires the named mobile owner; placement alone does not authorize sticky.
- “Continue”, “Submit” and “Confirm” are insufficient labels when context does not make the outcome
  unambiguous.

## Invariants

- At most one recommended outcome exists per surface state.
- Every rendered action has a reachable destination or product operation.
- Variant follows action role; size follows placement.
- Embedded action uses `sm`; standalone action uses `md` unless its owning component fixes otherwise.
- Pending keeps label width, blocks duplicate press and retains outcome meaning.
- Utility/back actions do not occupy the primary action anchor.
- Destructive action uses `ConfirmButton`, never an invented danger appearance.
- State, permission and value evidence are inputs, not afterthoughts.

## Review Output

```text
surface_job: <one job>
state: <closed state>
primary: none | <label -> destination>
actions:
  - <label>: primary | secondary | outline | tertiary | ghost | text-link | confirm-button
placement: embedded | standalone | toolbar | navigation | persistent-mobile
size: sm | md | component-owned
path_onward: <action or destination>
evidence: <fact selecting this tree>
result: resolved | INSUFFICIENT CONTEXT
```

## Load Policy

1. Apply `INDEX.md` first.
2. Read `prompt.md` for business-only stress tests.
3. Read `vi.md` for Vietnamese explanation.
4. Read `example.md` for StarCi Academy UI/Code.
5. Load governance records only when auditing or versioning.

## Version Rule

`changelog.md` owns the module version. Accepted changes increment `0.01` and update all six records.

