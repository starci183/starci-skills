---
id: fe-blocks-laws-b10-state-enumeration-index
title: INDEX.md
slug: /fe/blocks/laws/b10-state-enumeration
sidebar_label: b10-state-enumeration
sidebar_position: 0
description: Binding rules for enumerating a block's states before drawing it, including the test that separates a state from a prop.
---

# INDEX.md

Version: `2.00` · Module: `b10-state-enumeration` · Law: `B10` · Refusals: **3**

## Law

List every state before drawing any of them. A **state** is a situation that picks a **different
tree**; anything that draws the same tree with different words is a prop.

> rồi bôi đen thì sao, vô từng bài đọc, làm từng challenges thì sao??? xác định đủ state chứ

Enumeration is not a formality. A state discovered after the tree is built arrives as an extra
branch bolted onto a shape that was not designed to hold it.

## Situation Codes

| Code | Situation | Rule |
|---|---|---|
| `B10-1` | A situation draws a different tree | it is a state, and it is named |
| `B10-2` | Several situations draw the same tree with different values | they are props plus one `isLoading`, not several states |
| `B10-3` | The block owns a request | the settle ladder runs `failed → pending → empty → ready`, in that order |
| `B10-4` | The envelope can be `undefined` or `null` | `undefined` is pending, `null` is empty — never merged |
| `B10-5` | Two names exist for the same situation | choosing the synonym requires a stated reason |
| `B10-6` | The reader is working through steps | the state is a **step machine**, not a load ladder |
| `B10-7` | The server declares N outcomes | the block enumerates N **plus** the situations only the client can be in |
| `B10-8` | A cluster receives already-settled strings from its parent | it has **no state ladder** — its two situations are `slot present` and `slot absent` |

`B10-2` IS THE TEST THAT DOES THE WORK. Applied honestly, it deletes states rather than adding them:
four rail blocks discovered they had none at all, because loading, empty, failed and ready all draw
the same row and only the figure changes.

`B10-7` IS WHY ENUMERATION IS NOT A SCHEMA COPY. The judge strip carries eleven situations: the
server's nine, plus idle, plus a lost socket — the client going deaf while judging continues. No
backend type would ever have told anyone about the eleventh.

`B10-8` IS THE MOST EXPENSIVE OMISSION MEASURED. In one scored blind build it alone produced five
wrong answers, because every sub-cluster of a rail was given `pending / empty / failed` when the
rail had already resolved every string before handing them down. Only a cluster that **reads** owns
a ladder. Everything downstream of it is present or absent.

## Inputs

| Input | Evidence required |
|---|---|
| `situations` | Every situation, in words, before any tree exists |
| `treePerSituation` | Which tree each one draws — identical trees collapse into props |
| `envelope` | `undefined` · `null` · `empty` · `populated` |
| `clientOnlySituations` | Situations the server cannot report: lost socket, expired session, stale day boundary |
| `stateShape` | `union-roi-rac` (a discriminated union carrying per-branch props) or `enum-phang` (a flat enum plus one props object) |

## Invariants

- A state name comes from the closed vocabulary of fifteen literals measured in the tier.
- `settled`/`ready` and `empty`/`hidden` are synonym pairs. The gate demands a written reason before
  accepting the second of each pair.
- The ladder reads failure first. Reading pending first makes a permanently failing request shimmer
  forever.
- A step machine's steps are business steps, and each of its buttons carries its own pending flag —
  see [`b11`](../b11-pending-owner/INDEX.md).
- Both state shapes are legal, and the plan states which one is used.

## Exceptions

- **A block with no state at all.** Legal and correct when every situation draws the same tree. The
  block then has `props` and one `isLoading`, and its docstring says so.
- **A caller-parameterised item.** Its state arrives from the list; it enumerates only the situations
  of its own mutation.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| Enumerate the full state set before drawing | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-ai-chatbot.md:263` | "User feedback: \"rồi bôi đen thì sao, vô từng bài đọc, làm từng challenges thì sao??? xác định đủ state chứ\"." |
| Ten source states are not the whole state space | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-ai-chatbot.md:1009` | "User correctly identified that chatbot state space is much larger." |
| A partial state matrix is not acceptance | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-ai-chatbot.md:1116` | "User required full coverage." |
| A state is a situation that picks a different tree | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\StreakStatRow\index.tsx:14-16` | — |
| The four-rung settle ladder | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\WeeklyChallengeCard\index.tsx:31-37` | — |
| Eleven situations, the eleventh declared by nobody | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\coding\JudgeStatusStrip\component.tsx:33-45` (the union), reason at `:26-28` | — |
| The two coexisting state shapes | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\courses\CoursePricingRail\component.tsx:119` | — |

## Scope

This module decides how many states exist and what they are called. What each state renders is the
archetype module; who owns the pending flag inside one is
[`b11`](../b11-pending-owner/INDEX.md); whether the failure is visible is
[`b12`](../b12-error-owner/INDEX.md).

## Version Rule

Increment all five records by `0.01` for an accepted rule change. Adding a literal to the state
vocabulary is a minor bump and must be reflected in `gate.schema.json`.
