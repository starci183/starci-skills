---
id: fe-senses-restraint-index
title: INDEX.md
slug: /fe/senses/restraint
sidebar_label: restraint
sidebar_position: 0
description: Machine-oriented gate requiring every emphasis, edge, and control to earn a job.
---

# INDEX.md

Version: `1.02`

Vietnamese guide: [vi.md](vi.md) · Human examples: [example.md](example.md)  
Governance: [audit.md](audit.md) · version history: `changelog.md`

## Objective

Every emphasis, edge, and control MUST earn one named job in the current surface. Remove candidates
with no job and route valid candidates to their owning module instead of inventing duplicate rules.

## Load Policy

1. Apply this file only as a subtraction/routing gate.
2. For emphasis/reading order, load [hierarchy](../hierarchy/INDEX.md).
3. For an edge/surface boundary, load [surface-in-surface](../../gates/principles/surface-in-surface/INDEX.md).
4. For a control/ask/path onward, load [call-to-action](../call-to-action/INDEX.md).
5. Read `vi.md` for guided Vietnamese reasoning and `example.md` for concrete cases.
6. Do not load `audit.md` or `changelog.md` during ordinary implementation.

## Candidate Vocabulary

| Candidate | It earns a job only by proving | Owning module |
|---|---|---|
| Emphasis | A specific reading rank/semantic state that cannot be carried by existing structure | [hierarchy](../hierarchy/INDEX.md) |
| Edge | A membership/boundary claim not already made by an enclosing surface | [surface-in-surface](../../gates/principles/surface-in-surface/INDEX.md) |
| Control | A usable outcome, utility, recovery, disclosure, or path onward needed in this context | [call-to-action](../call-to-action/INDEX.md) |

## Decision Procedure

1. State the surface's job in one sentence.
2. Inventory every added emphasis, edge, and control—not only the primary or visually loud ones.
3. For each candidate, write one observable job from the vocabulary above.
4. If no job can be named, remove the candidate.
5. If two candidates perform the same job, keep the clearest owner and remove/demote the duplicate.
6. If a job is valid, load the owning module and satisfy its full procedure; restraint does not approve
   the implementation by itself.
7. Re-run the inventory for loading, empty, error, disabled, ready, narrow, and wide states.
8. Reject subtraction that removes required meaning, focus, status, recovery, or a usable path onward.

## Invariants

- “Decoration”, “balance”, “modern”, “premium”, and “more obvious” are not observable jobs.
- Restraint means justified presence, not arbitrary visual minimalism.
- One candidate MUST NOT compensate for an unresolved failure in another module.
- Duplicate emphasis, duplicate boundary, and duplicate primary asks are removed at their owners.
- A valid candidate still must pass hierarchy, surface, or CTA rules.
- Required accessibility cues, semantic state, focus visibility, error recovery, and path onward MUST
  NOT be removed merely to make a surface quieter.
- State and responsive branches MUST NOT add furniture that has no settled-state job.
- Product content is not clutter merely because it is detailed; remove unearned presentation, not
  evidence the reader needs to decide.

## Review Output

Produce one row per candidate:

```text
surface job: <one sentence>
candidate: <element/style>
kind: emphasis | edge | control
observable job: <reading rank | semantic state | membership | outcome | utility | recovery | disclosure | path onward>
owner module: hierarchy | surface-in-surface | call-to-action
duplicate of: none | <candidate>
required across states: loading | empty | error | ready | narrow | wide
decision: keep-and-validate | demote | merge | remove
```

Reject `keep-and-validate` when `observable job` or `owner module` is missing. Then run the selected
owner module; this record is only a gate.

## Version Rule

`changelog.md` owns the module version. Increment accepted module changes by `0.01` and update every
module record. `audit.md` is advisory and cannot create a new candidate kind or job by itself.
