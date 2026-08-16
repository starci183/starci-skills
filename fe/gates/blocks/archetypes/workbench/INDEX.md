---
id: fe-blocks-archetypes-workbench-index
title: INDEX.md
slug: /gates/blocks/archetypes/workbench
sidebar_label: workbench
sidebar_position: 0
description: The anatomy of a panel where the reader works rather than reads — a step machine, not a load ladder.
---

# INDEX.md

Version: `2.00` · Module: `workbench` · Archetype: `A6` · Live instances: **5**

## Law

**Where the reader works, the state is a step machine, and every control carries its own pending
flag.**

A load ladder answers *has the data arrived*. A step machine answers *where in this task is the
reader*. They are different questions, and a panel that models the second as the first loses the
reader's place the moment anything is slow.

## Situation Codes

| Code | Situation | Anatomy |
|---|---|---|
| `A6-1` | The reader progresses through steps | state is the step: `details \| code \| done`, `renaming \| archiving`, `submitting` |
| `A6-2` | Each control | reads its own `isPending` from props and refuses a second press on its own |
| `A6-3` | A refusal must be announced | one status sentence plus a flag saying it is a refusal, so it is announced and not merely shown |
| `A6-4` | Real form semantics are needed | this is the only archetype that may touch raw DOM, and only for that reason |
| `A6-5` | Local step state | this is the only archetype whose presentational half may hold `useState` |

`A6-5` IS BOUNDED, NOT OPEN. Exactly two `component.tsx` files in the whole tier hold `useState`,
and both are here. A third would need its own reason.

## Inputs

| Input | Evidence required |
|---|---|
| `steps` | The ordered steps, named for the work, not the request |
| `controls` | Each control and its own pending source |
| `refusalCopy` | The sentence shown when the step is refused, and how it is announced |
| `domReason` | Why a raw element is required, if one is |

## Invariants

- Steps are business steps. A step named after a request is a load ladder wearing a step's name.
- No control shares a pending flag with another — [`b11`](../../laws/b11-pending-owner/INDEX.md).
- A refusal is announced, not only rendered.
- Raw DOM appears only for genuine form semantics; four occurrences in two files, and no more.

## Exceptions

- **A panel that also loads.** It has both: a step machine for the work and a loading flag per
  control. They do not merge into one union.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| A refusal flag distinct from the pending flag | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\auth\AuthenticationPanel\component.tsx:54-59` | — |
| The step union | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\auth\AuthenticationPanel\component.tsx:109` | — |
| Real form semantics, twice | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\auth\AuthenticationPanel\component.tsx:217` | — |
| Each control reading its own pending from the step | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\ai\StarCiAiChat\component.tsx:222-227` | — |
| Splitting one ambiguous button into separate owned actions | neo TỪ CHỐI | `.workflows\designs\starci-academy\cv-edit-submit-rag.md:154` | "Legacy và backend có mutation/state ownership khác nhau; trộn sẽ che credit, failure và persistence boundary." |
| A step's failure must be visible in every layout | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-ai-chatbot.md:1118` | "A2/mobile otherwise hide the failure." |

## Scope

This module decides the shape of a working panel. Whether a situation is a state at all is
[`b10`](../../laws/b10-state-enumeration/INDEX.md); who waits is
[`b11`](../../laws/b11-pending-owner/INDEX.md).

## Version Rule

Increment all five records by `0.01` for an accepted change.
