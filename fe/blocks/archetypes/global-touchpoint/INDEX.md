---
id: fe-blocks-archetypes-global-touchpoint-index
title: INDEX.md
slug: /fe/blocks/archetypes/global-touchpoint
sidebar_label: global-touchpoint
sidebar_position: 0
description: The anatomy of an always-present touch point that belongs to no page.
---

# INDEX.md

Version: `2.00` · Module: `global-touchpoint` · Archetype: `A8` · Live instances: **4**

## Law

**A global entry has one action, the narrowest possible props, and no loading ladder — because it
belongs to no page's data.**

It is always present, so it never waits on anything a page is fetching. If it appears to be loading,
it is loading something of its own.

## Situation Codes

| Code | Situation | Anatomy |
|---|---|---|
| `A8-1` | Public data | as narrow as the job allows: a label, an open flag, a presence flag; or `guest \| signedIn` |
| `A8-2` | Actions | exactly one |
| `A8-3` | It hosts a menu | it hangs off a shell and its presentational half only describes the items |
| `A8-4` | Where it sits | the mount owner decides, and it is not this block |
| `A8-5` | An unread or count indicator | presence only, unless a producer serves a count — [`b5`](../../laws/b5-no-invented-field/INDEX.md) |

`A8-4` IS THE ONE THIS ARCHETYPE CURRENTLY BREAKS. The floating trigger pins itself to the viewport
with an inline style — the only inline style in the whole tier.

## Inputs

| Input | Evidence required |
|---|---|
| `entryData` | The narrow data the trigger needs |
| `action` | The single action |
| `mountOwner` | The chrome or root that mounts it |
| `indicatorProducer` | The producer serving the indicator, or `none` |

## Invariants

- One action. Two actions means this is a menu host, and the menu is the second action's home.
- No loading ladder. A global entry that shimmers because a page is fetching is coupled to a page.
- The block does not place itself.
- An indicator without a producer shows presence, never a number.

## Exceptions

- **Menu hosts.** `AccountMenu` and `LanguageMenu` hang off a dropdown shell, so their presentational
  halves describe items rather than draw a surface. Still `A8`.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| The narrow data shape of a global trigger | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\ai\StarCiAiFab\component.tsx:7-17` | — |
| The live `A8-4` violation | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\ai\StarCiAiFab\component.tsx:35` | — |
| A menu host declares itself a pure block half | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\auth\AccountMenu\component.tsx:129` | — |
| A global owner mounts at the root, not in repeated chrome | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-ai-chatbot.md:708` | "`ShellNav` is repeated by route clusters and would drop conversation state on cross-cluster navigation." |
| A provider owns contexts, not visual composition | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-ai-chatbot.md:122` | "Providers own contexts, not visual composition." |
| A fabricated count indicator is refused | neo TỪ CHỐI | `.workflows\designs\starci-academy\shell-account-language-menus.md:385` | "Current FE/backend evidence không có badge count." |
| A static icon loses signed-in identity | neo TỪ CHỐI | `.workflows\designs\starci-academy\shell-account-language-menus.md:383` | "User yêu cầu legacy dropdown và static icon mất identity/journeys." |

## Scope

This module decides the shape of a global entry. Where it mounts is
[`layouts`](../../../layouts/gate.schema.json) — and the fact that this block currently decides it
itself is a finding, recorded in `audit.md`.

## Version Rule

Increment all five records by `0.01` for an accepted change.
