---
id: fe-blocks-laws-b12-error-owner-index
title: INDEX.md
slug: /fe/blocks/laws/b12-error-owner
sidebar_label: b12-error-owner
sidebar_position: 0
description: Binding rules that a failure has a visible owner in every layout, and the one condition under which it may be invisible.
---

# INDEX.md

Version: `2.00` · Module: `b12-error-owner` · Law: `B12` · Refusals: **1**

## Law

A failure has a **visible owner in every layout**. A block that owns a request reads its error and
gives it somewhere to be seen.

A failure is a **settled answer**, not a wait. Treating it as a wait produces the worst render the
product can make: an interface that shimmers forever, telling the reader to keep waiting for an
answer that has already come back and is negative.

## Situation Codes

| Code | Situation | Rule |
|---|---|---|
| `B12-1` | The block owns the request and it failed | a `failed` state with a visible notice and a retry |
| `B12-2` | The failure is folded into an invisible render | legal **only** with a named product reason, written in the block |
| `B12-3` | The block owns a request but never reads `.error` | refused — it shimmers forever |
| `B12-4` | The block's state comes from the caller | it does **not** read `.error`; the failure belongs to the list |
| `B12-5` | The layout has no pane where a failure could appear | the failure is raised to a level that has one |

`B12-3` IS NOT A HYPOTHETICAL. One block computes its state as "data is undefined, therefore
pending" and reads no error at all. When its profile query fails, it shimmers for as long as the
backend is down.

## Inputs

| Input | Evidence required |
|---|---|
| `ownsRequest` | Whether this block reads a request of its own |
| `errorRead` | The line where `.error` is read, or the reason it is not |
| `productReason` | For `B12-2`: the named viewer condition making the invisible render correct |
| `retry` | The action the reader can take, or the reason none exists |
| `layoutPane` | Where the failure appears in each layout the block renders in, narrow included |

## Invariants

- A block owning a request reads its error, always.
- A failure branch is distinct from an empty branch: it carries a retry.
- Failure is read **first** in the settle ladder, before pending.
- An invisible failure carries a written product reason. Without one, it is `B12-3`.
- A block whose state comes from the caller does not invent an error branch; it would be lying about
  a request it does not own.
- A failure must not be hidden by a layout that has no room for it; if the narrow layout drops the
  pane, the failure moves up.

## Exceptions

- **Signed-out identity rows.** Four rail blocks fold failure into an invisible render because that
  is precisely what a signed-out reader should see, and each says so in its own words. The written
  reason is the exception, not the pattern.
- **Caller-parameterised items.** Three blocks read no error and are correct: their state comes from
  the list, and they own only their own mutation.

## Anchor

| Claim | Kind | Anchor | Quote |
|---|---|---|---|
| A fallback masking a failed request is refused | neo TỪ CHỐI | `.workflows\fidel\starci-academy\courses-auth-redirect-and-nav-icon.md:340` | "The backend catalog returns five courses on the canonical origin." |
| The honest failure message is kept rather than papered over | neo TỪ CHỐI | `.workflows\fidel\starci-academy\courses-auth-redirect-and-nav-icon.md:266` | "API trả 5 courses ở `localhost`; component failure message is honest for the failed request." |
| A failure must not be hidden where the layout has no pane for it | neo TỪ CHỐI | `.workflows\designs\starci-academy\global-ai-chatbot.md:1118` | "A2/mobile otherwise hide the failure." |
| Failure is a settled answer, not a wait | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\StreakStatRow\index.tsx:22-26` | — |
| The live `B12-3`: state computed with no error read | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\profile\ProfileHero\index.tsx:58` | — |
| A `B12-2` with its reason written down | neo CODE | `D:\Repositories\starci-academy-fe\src\components\blocks\dashboard\CreditStatRow\index.tsx:17-21` | — |

## Scope

This module decides where a failure is seen. What the failure says is `copy`; whether the empty and
failure branches share a shell is [`b4`](../b4-empty-is-a-state/INDEX.md). Its output is the
`errorOwner` field of [`gate.schema.json`](../../gate.schema.json).

## Version Rule

Increment all five records by `0.01` for an accepted rule change.
