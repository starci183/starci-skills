---
id: fe-layouts-l12
title: L12 — Business input becomes explicit block briefs
slug: /gates/layouts/laws/l12-business-to-block-brief
description: Prevents raw business intent from collapsing into unnamed regions or invented components.
---

# L12 — Business input becomes explicit block briefs

Version: `1.00`

## Law

Every business outcome becomes an explicit block brief before any component is designed. The brief
must say whether the block exists, whether this candidate uses it, what it renders, where it sits,
which states it needs, and whether the contract registry is reused, extended, or missing.

The law refuses two shortcuts:

- a region name without a render brief is not a block;
- a proposed component name without registry evidence is not an existing contract.

## Situation codes

| Code | Situation | Required output |
|---|---|---|
| `L12-1` | Registry already expresses the intended frame | `existing + reuse + registry CSS` |
| `L12-2` | Registry is close but cannot express the new business outcome | `modify + extend + proposed CSS + full brief` |
| `L12-3` | No honest registry match exists | `new + new-required + proposed CSS + full brief` |
| `L12-4` | Item is conditional, on-demand, or deliberately unused | keep it explicit and write `activationOrReason` |
| `L12-5` | Exact anatomy belongs to the next gate | put the unresolved decision in `gate2Questions` |

## Invariants

- Each candidate plan has exactly `business`, `main`, and `extends`.
- Every block has purpose, data, render brief, states, placement, usage, contract decision and reason.
- Existing CSS is copied from `src/components/contracts/index.ts`; proposed CSS is labelled proposed.
- Three to four candidates differ by product thesis, not paint.
- No candidate proceeds until a founder acceptance event binds its canonical SHA-256 hash.

## Scope

This law owns business-to-block decomposition. `starci-fe-design-layout` applies it once per root or
discovered page, layout, modal, drawer or overlay surface.
`starci-fe-design-block` then owns component anatomy, files, tiers, pure-connected split, props,
actions, copy, surfaces and pending ownership, producing 3-4 proposals independently for every
selected block. `starci-fe-design-execute` takes the settled blocks through principles, patterns and
lints.
