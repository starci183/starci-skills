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

## Enforced by

- [`check-story-anatomy.mjs`](../../../../scripts/check-story-anatomy.mjs) — a story under a required
  tier that does not use `BlockAnatomy` is a violation.
- [`check-no-vietnamese.mjs`](../../../../scripts/check-no-vietnamese.mjs) — any Vietnamese in a story
  or component (outside the sanctioned endonym) is a violation.

---

Architecture: [`concept.md`](concept.md) · Rules: [`elements/`](elements/) ·
Principles: [`principles/`](principles/)
