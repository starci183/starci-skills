# story — a component read as a storymap

A story is not a demo. It is the **storymap**: the one place a reader learns a component by *reading
it*, so it must render every state of every prop, each annotated with why that state exists. Two
people who open the same story must come away with the same understanding — the same discipline the
rest of this architecture runs on.

## The rule

**Every component story is built with `BlockAnatomy`.** A bare `<X … />` in a wrapper is not a story
— it shows one frozen look and teaches nothing about the prop that produced it.

`BlockAnatomy` takes:

| field | what it holds |
|---|---|
| `name` · `tier` | which component, which tier — drives the panel |
| `annotate` | per rendered part: its `tier` + `role` (and `storyId` to jump to another component's story) |
| `leaf` | the ONE prop this story maps — **one prop = one leaf** (atom tier, §12g) |
| `reason` | why this prop exists, in a sentence |
| `states[]` | one entry per value the prop can take: `{ name, why, code, render }` |

Each state's `why` says *when* to reach for it, `code` is the exact call that produces `render`
(word-for-word, so the Code tab matches the picture), and `render` is the live component.

## Full coverage, per prop

A leaf renders the **whole** set of a prop's values — every member of a union, both shapes of a
boolean, every size. A reader comes to a story asking "what does this prop do", so a prop shown at
one value only is a story with a hole. One prop, one leaf, all its values.

## A data-owning tier's story renders the `skeleton` state

A block, layout, or page owns data, so its story must render the **`skeleton`** state — the first-load
shape, before anything is in hand — alongside content and empty. That has a consequence for the
component's shape: the presentational `_Name` MUST expose an **`isSkeleton?: boolean`** prop and
propagate it to every leaf it draws — each atom, frame, and composite takes its OWN `isSkeleton` and
switches to a co-located shimmer, so the story can set `isSkeleton: true` and see the real skeleton.
Because the skeleton is the SAME tree as the loaded state with `isSkeleton` threaded through, it
mirrors the loaded shape automatically and cannot drift. A block that models only content/empty is
**unfinished** — when its connected half is wired up ([`split.md`](split.md)), there is no `isSkeleton`
to pass, so the first-load shimmer is silently dropped at sync. `error` is NOT a per-block prop, and
`isEmpty` stays derived from the resolved data.

This is the story-side of two rules that already exist elsewhere: [`split.md`](split.md) says the
connected half computes `isSkeleton` from the first-load formula and hands it — with the resolved data
and `isEmpty` — to `_Name`, and
[`loading-and-skeleton.md`](../authoring/loading-and-skeleton.md) keeps the shimmer co-located in the
leaves so it mirrors the loaded shape rather than being gathered into a separate skeleton that drifts.
The gap was that this file only required enumerating "every value of each prop" — it never required a
data-owning tier to HAVE the `isSkeleton` prop, so blocks shipped with no skeleton state and still
passed the story gate.

Anchor: across every nivo mirror-tree sync slice — invoices, wallet, domains, support, leads
(four-plus independent cases, 2026-08-03) — the sync surfaced book blocks that shipped with NO skeleton
state, exposing no `isSkeleton` and modelling only empty and content, so the connected halves had no
first-load shimmer to render.

## Everything in English

All story text is English — `leaf` / `reason` / `name` / `why` / `code`, the demo labels in `render`,
and the JSDoc/comments. The Code tab must read the same words as the picture. The one exception is a
language-picker endonym (`{ code: "vi", label: "Tiếng Việt" }`) — a language's own name in a selector.

## Scope — who must, who is exempt

| tier | story format |
|---|---|
| **atom · frame · composite · block** | `BlockAnatomy` storymap — **required** |
| **page** | a full-state render — each story is ONE complete page state (empty · loading · error · paid …), not a leaf-per-prop map, because a page has no props to enumerate, it has states to show |
| **behavior · util** | exempt — a scroll behavior or an overlay helper is not a tiered component with a prop table to read |

`AnatomyTier` has no `page` or `layout` member (`heroui · atom · frame · composite · block · screen`),
so a **page or layout** story passes `tier="screen"` to `BlockAnatomy` — the top arrangement tier —
rather than inventing a missing name (2026-08-03).

## Enforced by

- [`check-story-anatomy.mjs`](../../../../scripts/gates/check-story-anatomy.mjs) — a story under a required
  tier that does not use `BlockAnatomy` is a violation.
- [`check-no-vietnamese.mjs`](../../../../scripts/gates/check-no-vietnamese.mjs) — any Vietnamese in a story
  or component (outside the sanctioned endonym) is a violation.

---

Architecture: [`concept.md`](concept.md) · Rules: [`elements/`](elements/) ·
Principles: [`principles/`](principles/)
