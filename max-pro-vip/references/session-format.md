---
name: session-format
description: The feedback session file format and how to mark regions. Read when opening a long session, or reopening an old session from a cold start.
---

# Session

A feedback session is **not one round of fixes**. It runs across multiple rounds and usually spans several context windows. So session state lives **on disk, not in context** — log a decision the moment it's made, so the next round can pick up from a cold start.

## Directory format

`.artifacts/feedback/<YYYY-MM-DD>-<target-slug>/`

| File | Contains |
|---|---|
| `session.md` | persistent log: target · regions · each round · open items · an `out-of-scope` entry |
| `baseline.json` | measurements taken when the session opened, **before** touching anything |
| `round-<n>.md` | round n's results |

`session.md` is the contract for closing the session. Keep it updated **while the round is running**, don't leave it to the end.

**Don't log passing cells.** Only log what's off, what was fixed, what's still open.

## Marking regions

A region is the **unit of scope** for the whole session. Mark it wrong and every later round is off too.

The teacher can pick either path — don't force him into yours.

**Path 1 — the teacher gives a screenshot with colored circles.** Your job is to translate the circled region into a **real component**, and once translated, say it back to the teacher for confirmation before sweeping:

> "The pink region I take to be the URL row in `ChallengeDeliverableList`, the yellow region is the brief box on the left. Correct?"

A screenshot can only tell you **where**, never **which component**. Two nested components can look identical in a screenshot. Mistranslating this sweeps the whole session wrong, and the error is silent — so **always confirm**, even when it looks obvious.

**Path 2 — you render a numbered overlay.** When it's inconvenient for the teacher to circle things, number the regions for him to pick:

```js
[...document.querySelectorAll('[data-anat-part]')]
    .map((el, i) => `${i + 1}. ${el.getAttribute('data-anat-part')}`)
```

The teacher just says "regions 2 and 5." Faster than circling by hand when the screen has many nodes.

## Each region logs three things

| Field | Content |
|---|---|
| `id` | a stable code reused across every round (`R1`, `R2`…). **Don't change it partway through** — old rounds point to it |
| `component` | the **real** component name + file path, not a description of its position |
| `intent` | one line: what the teacher sees wrong here, or "not sure yet, look into it" |

The `intent` column may be left empty in the sense of "the teacher hasn't said, look into it yourself" — but it must **explicitly state that it's empty**, don't invent an intent and sweep against it.

## Stop when

- A region spans multiple components and it's unclear which one the teacher means ⇒ ask, don't default to the biggest one just to be safe.
- A region falls inside `src/` instead of `.storybook` ⇒ stop entirely. `src` is read-only.
- The teacher circles a **vendor glyph**, not a component of the system ⇒ state that boundary clearly before accepting the region.
