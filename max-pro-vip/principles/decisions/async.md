---
name: async
description: Decision sheet for the async axis — decide what to draw for empty/error/loading and who is allowed to draw it when admitting a new entry into the library. Does not answer what the shimmer shape looks like (see `skeleton`).
scope: the four branches of a data region + the "who owns it" axis
---

# ASYNC

## Scale — four branches, fixed order

**`error` → `loading` → `empty` → `content`**

| Branch | Condition | Who draws the shape |
|---|---|---|
| `error` | `error` is truthy **AND** `errorContent` exists — **beats even `isLoading`** | composite error |
| `loading` | `isLoading` is true | `skeleton` slot, supplied by the caller |
| `empty` | `isEmpty` is true | composite empty if `emptyContent` exists, otherwise **`null`** |
| `content` | remaining | `content ?? children` |

This is a rare case where **the scale and the decision tree are the same thing** — the code is an if/else-if in exactly the order above.

## Who gets to call this branch

| # | Ask | Result |
|---|---|---|
| 1 | Is the blanked-out region the **entire** render function of the screen? | SCREEN calls it directly, **early-returns the whole thing** |
| 2 | Does the region have **its own frame that must be preserved** (card/accordion)? | if the frame already has its own axis, **use that axis** — don't force it through the async composite |
| 3 | Loading but **structure doesn't change**, just shimmer piece by piece? | not this axis — `isSkeleton` flows down to the atom |
| 4 | Remaining | BLOCK calls the async composite |

**Atom never appears here** — an atom doesn't know about data.

| State | atom | composite | block | screen |
|---|:---:|:---:|:---:|:---:|
| error | no | draws the shape when told to | **owns** the decision | no case yet |
| loading | no | receives `isLoading` | owns both the decision and the shape | just forwards it |
| empty | no | draws the default shape | usually owns it | there's precedent, **rule not finalized yet** |
| content | no | just forwards it | **owns** it | just arranges blocks |

## Three adjacent pairs

| Pair | The deciding test |
|---|---|
| `error` ↔ `loading` | is error set **and** does `errorContent` exist? ⇒ `error` **always wins**, even while `isLoading` is still true. There is no such thing as "loading means the error has to wait" |
| `loading` ↔ `empty` | is `isLoading` definitely `false` yet? **An empty array is not automatically "truly empty"** if the first request is still running. The caller must collapse the condition itself |
| `empty` ↔ `content` | count the real `length`. `undefined` (fetch not finished yet) is **not** `isEmpty` |

Reasoning and history: [rationale](../../references/axis-notes/async/rationale.md)
Rules no machine catches: [judgement](../judgement.md)
