---
name: house-rules
description: Five rules that apply to EVERY lane. Read at the start of any FE work; skills point back here instead of copying it.
---

# House rules

These five rules stand above every skill. Any skill that contradicts this file is the wrong skill.

## 1. Small context — load on demand, never load just in case

Read `library/registry.json` via `scripts/lookup.mjs`; never open the whole file. Open `principles/judgement.md` when auditing. Open `principles/decisions/<axis>.md` **only when** proposing a library entry. Open `references/axis-notes/<axis>/rationale.md` **only when** you need the reasoning behind a rule.

Never load all 15 axes before looking at the screen. Loading just in case is an insurance premium paid every session, whether that session turns up two bugs or twenty.

**Fan-out scale:** under 6 suspect cells, work inline — don't spawn an agent. Under 15 regions, one agent per region. Only at 15 regions or more does axis become the fan-out unit.

## 2. Measure, don't look — and consult sources in authority order

Every verdict cites a real number (`getComputedStyle`, `getBoundingClientRect`) or a real line of source. A screenshot can prove what something **looks like**, never what value **produced** it.

Check the viewport before trusting any measurement — with `document.hidden` set or `innerWidth` at 0, every rect comes back 0, and healthy code looks exactly like it's broken.

Authority order when two sources conflict:

| # | Source |
|---|---|
| 1 | the real `src` of the component being edited — measure it |
| 2 | the contract in `library/` |
| 3 | the axis's decision tree in `principles/` |
| 4 | outside industry — only when canon is **silent**, see [`research-when-silent.md`](research-when-silent.md) |

**A green gate is not a verdict.** The ten gates cover a small slice of the fifteen axes. "Gate is green" never answers "is this axis correct."

Don't drive the browser just to eyeball it. Measuring the DOM is fine; opening Storybook to look is slow and prone to hanging. Report the numbers and let the teacher look for himself. When the teacher says stop, stop for the rest of the session — even when you think "this time it'll probably work."

### The nine costumes of one failure

A scan of all 103 Forbidden rules found nine that were written into nine different axes but are the
same rule: **concluding before verifying.** They live here now, not in the axes.

| The move | Why it fails |
|---|---|
| reporting done after reading the code, without measuring | code says what was intended; `getComputedStyle` says what happened. A `gap` can be dropped in silence — no compile error, no lint, nothing |
| reporting done without running `tsc --noEmit` after adding a union | TypeScript does not narrow a destructured value on the `false` branch. The break shows up later, in bulk |
| copying a value from a component with a different `src` | two components with the same picture can both be right at different values, because each is anchored to its own source |
| inferring a variant from a component that "looks similar" | the source you are copying may itself be wrong — two authors have already picked two different variants for one pattern |
| bumping a size above `src` on your own | five out of five real incidents were bumping up. Not one was bumping down. Suspect yourself when the impulse is "make it bigger" |
| rounding an asymmetric value from `src` without noting the drift | silence makes the next reader believe it is an exact port |
| citing an anchor from documentation without grepping the file | one anchor died because the file had been rebuilt the same day |
| trusting a log that says "already fixed" | a log records intent. One fix was logged as done and had never reached disk |
| judging something safe by scanning story data alone | the debt sits in the component's **type**, not in today's data. Current data merely has not used the permission yet |

One line covers all nine: **cite a number, a source line, or a grep — never an impression, never a
log, never a lookalike.**

## 3. Get requirements right — ground in the real business

Before building anything with data: open the right domain in `.artifacts/domain/INDEX.md`. If a domain has already been extracted, don't re-extract it, and don't query Postgres or spin up an agent to re-read the entity.

Don't invent fields, don't invent states, don't invent business logic. If there's no real description yet, ask one question — cheaper than building it wrong and redoing it.

Don't expand scope. Only touch the selected region. If you spot a violation elsewhere, log it under the `out-of-scope` entry of the session log — don't fix it on the side.

Don't close the loop on the teacher's behalf. Silence isn't agreement; the teacher changing the subject isn't either.

## 4. Visualize for feedback

Vague feedback means **build options to look at**, don't code right away. Something that needs explaining means **draw it**, don't write a long chat message. Details and how to pick the tool: [`visualize.md`](visualize.md).

## 5. Strong feedback — remember it next time

A round of feedback isn't done when the code is fixed. It's done when **the gap has been patched at the rule layer**.

| What the teacher just said | Where it closes |
|---|---|
| a specific bug, canon already has the rule | fix the code. Don't touch canon |
| a canon rule that doesn't exist yet | `principles/judgement.md` if no machine can catch it, `principles/decisions/<axis>.md` if it is a scale or a tree branch, `docs/API-BACKLOG.md` if an API could delete it — needs **two independent sources** to become a general rule |
| a way of working, a habit to change | this file, or the `SKILL.md` of the relevant lane |
| a fact about the machine/repo/tooling | [`environment.md`](environment.md) |
| something true only for this conversation | don't log it anywhere |

A new rule must be **date-anchored** and cite a measurement or the teacher's own words. One example is not a rule; raising it to a general rule requires two independent sources — otherwise write it down as anchored to that exact case.

**A rule that doesn't fit any axis is a rule about to fall through the cracks.** Say so right away — don't let it go looking for a home on its own.
