---
name: foundation-triage
description: What happened to the ten foundation source notes. Five were scales and entered the library; five were rulings and went elsewhere. Read before assuming a source note belongs in the library.
measured: 2026-07-30
---

# Foundation triage

Ten source notes from the private canon repo. **Five were scales, five were rulings.** A note
sitting in a folder called `foundations/` is not evidence that it defines a scale.

| Source | Verdict | Where it went |
|---|---|---|
| `radius` | scale | `library/foundations/radius.md` |
| `gap` | scale | `library/foundations/gap.md` |
| `typography` | scale | `library/foundations/typography.md` |
| `elevation` | scale | `library/foundations/elevation.md` |
| `breakpoints` | scale | `library/foundations/breakpoints.md` |
| `z-index` | scale | `library/foundations/z-index.md` |
| `color` | **ruling** | `judgement.md` — tint vs solid, bounded-small vs section-large, and the alpha-vs-`color-mix` call all need the specific screen. The one machine-catchable slice went to `API-BACKLOG` |
| `motion` | **ruling** | `judgement.md` — the note disclaims a named scale itself. Default transition property, `prefers-reduced-motion` on decorative animation, one keyframes file, zero tooltip delay: four judgements, no ladder |
| `sticky` | **ruling** | `judgement.md` — a sticky offset is computed from what sits above it at that viewport, not chosen from a list |
| `scrollbar-gutter` | **ruling** | `API-BACKLOG` — one global CSS fix, not a value anyone picks |
| `wide-content-scrolls` | **ruling** | `API-BACKLOG` — a frame that must own its own overflow, catchable by a gate |

## The test that separated them

**Does it hand you a finite ladder of allowed values?** If yes it is a scale, and a contract can
state it. If it hands you a judgement to make per screen, no contract can hold it — writing it as a
library entry would mean writing prose into a slot meant for values, which is how a library turns
back into a rulebook.

`color` is the sharpest case. There **is** a colour scale — six semantic values — but it already
lives in the `color` decision sheet. What the foundation note held was something else: *when does a
token get used as a tint versus a solid fill*. Same subject, different kind of question.

## What the scales gave up on entry

Each entry had to answer two questions the template forces. Both found real problems:

| Scale | Steps that do not derive | Tokens colliding today |
|---|---|---|
| `radius` | `sm` `md` `lg` keep Tailwind values and do not track the root | `rounded-field` and `rounded-xl` both 12px — **5 live call sites use the wrong one** |
| `gap` | `gap-10` `gap-16` retired 2026-07-27, still in **20 files under `src/`** as debt | none — one root, so gap and padding can never drift apart |
| `typography` | `h6` and `body*` no longer exist in the union; dead vendor CSS remains | `h5` and `lg` both 18px but **different render paths** — one is a heading, one is a lead paragraph |
| `breakpoints` | none of the five derive; the trap is one level up | `lg` 1024px viewport · `@app-lg` 1024px container · **`@lg` 512px** — same-looking name, half the value, already live |
| `elevation` | no root exists at all | `shadow-surface` and `shadow-field` collapse together |
| `z-index` | `z-[1]` looks like a rung, is a local hack | `z-50` used by navbar, a tooltip, a popover and a full-screen overlay — four unrelated things |

Five of six scales carry a colliding-token pair. That is not a coincidence: two tokens agreeing on
a number is the normal way a system drifts, because agreement today reads as proof they are the
same thing.
