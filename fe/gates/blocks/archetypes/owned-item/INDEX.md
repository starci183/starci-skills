---
id: fe-blocks-archetypes-owned-item-index
title: INDEX.md
slug: /gates/blocks/archetypes/owned-item
sidebar_label: owned-item
sidebar_position: 0
description: The anatomy of an item inside a list that owns the data — the block owns only its own mutation.
---

# INDEX.md

Version: `2.00` · Module: `owned-item` · Archetype: `A4` · Live instances: **2**

## Law

**When the list owns the data, the item owns only its own mutation.**

This is the one archetype where a block legitimately receives a `state` from its caller. Everything
that follows comes from that: it does not fetch, it does not read errors, and it does not invent a
loading ladder for a request it cannot see.

## Situation Codes

| Code | Situation | Anatomy |
|---|---|---|
| `A4-1` | Public props | `BlockProps<State, Data>` **plus** the item identity and the outcomes it reports upward |
| `A4-2` | The connected half | calls **no** list query — only its own mutation hook |
| `A4-3` | Its mutation is running | it **overrides** the given state for the duration: `state={mutation.isMutating ? "adding" : state}` |
| `A4-4` | The request failed | it does not read `.error` — the failure belongs to the list |
| `A4-5` | An outcome must reach the list | it is reported upward as a callback, never resolved locally |

`A4-4` LOOKS LIKE A `b12` VIOLATION AND IS NOT. Three blocks read no error and are correct, because
they own no request. A fourth block reads no error and **is** a violation, because it does own one.
The difference is `ownsRequest`, not the absence of the read.

## Inputs

| Input | Evidence required |
|---|---|
| `itemIdentity` | The id or record the caller passes |
| `callerState` | The state values the list may hand down |
| `ownMutation` | The mutation this item owns, `file:line` |
| `reportedOutcomes` | The callbacks it raises to the list |

## Invariants

- The item never queries the list it belongs to.
- Received props are identity or outcome callbacks only — never styling, never placement.
- The mutation flag overrides state; it does not extend the state set —
  [`b11`](../../laws/b11-pending-owner/INDEX.md).
- A local truth flag that duplicates shared state is refused: a second surface showing the same cart
  would disagree with it.

## Exceptions

- **An item that opens an overlay.** It reports the request upward and the caller owns the overlay,
  because the overlay outlives the row.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| Public props carry identity and outcome callbacks | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\courses\CourseCatalogCard\index.tsx:36-41` | — |
| The mutation flag overrides the caller's state | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\commerce\CartLine\index.tsx:39-45` | — |
| A local truth flag is refused in favour of shared truth | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:1469` | "The local flag cannot survive another cart surface and removes the legacy reversible action." |
| Visible buttons are not fidelity when the mutation disagrees | neo TỪ CHỐI | `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:1467` | "Visible buttons are not fidelity when their mutation, route and post-click state disagree." |

## Scope

This module decides how an item behaves inside a list that owns its data. What the row renders is
[`b2`](../../laws/b2-chip-or-text/INDEX.md); how the rows align is
[`b7`](../../laws/b7-repeat-alignment/INDEX.md).

## Version Rule

Increment all five records by `0.01` for an accepted change.
