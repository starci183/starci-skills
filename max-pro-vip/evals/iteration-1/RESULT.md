---
name: eval-run-1
description: First real test of the two lanes. Three cases, both arms, graded blind. What it found and what changed because of it.
run: 2026-07-31
---

# Eval run 1

Three cases, run with the skill and without it in the same turn, graded against written
expectations by a separate agent.

| | with skill | baseline |
|---|---:|---:|
| Passed | **2 / 3** | **0 / 3** |

## Case by case

| # | Outcome | What happened |
|---|---|---|
| 4 | **skill-earned-it** | Baseline took the prompt's framing at face value, called crowding a *"breakpoint-gating problem"*, and never mentioned a record count. With-skill grepped the repo, found **no booking page or domain exists at all**, and refused to touch a breakpoint on that basis |
| 6 | **skill-earned-it** | Baseline reasoned from generic `flex-wrap` mechanics and hedged to *"it depends"*. With-skill quoted the canon rule verbatim, named the real breakpoint and the real composite, and cited the two files that shipped with columns glued together at every width |
| 1 | **both failed** | See below. The rule was wrong, not the runs |

Baseline scoring zero is the useful half of this. Cases 4 and 6 test two rules — *volume decides
the arrangement, width does not* and *`wrap` is not a breakpoint* — and a competent engineer
without the skill got both wrong. Those rules earn their place in canon.

## What case 1 found

The run reasoned: *nothing in this data says the bodies are hidden or collapsed*. That was correct,
and it contradicted the skill's own opening rule, which asserted that a long description **has to
be** hidden.

The rule was asserting a reading behaviour the data never carried. Length does not imply hiding.

**Fixed the same day.** The rule now asks the question that actually decides it:

> Does the reader need every body at once, or one at a time?

One at a time means the bodies compete, so they hide and open on demand. All at once means hiding
them costs the reader N clicks to reach what they came for. A row of five long paragraphs that must
be compared side by side is not an accordion, however long each paragraph is.

## What the harness got wrong

The prompt forbade writing files, so neither arm could render a widget — but an expectation demanded
one had been drawn. Both arms were marked down for obeying the instruction they were given.

`grader.md` now carries two rules that did not exist before this run:

- when a run is read-only, grade the **decision about drawing**, not the drawing
- **an expectation only checkable by writing is written wrong** — fix the expectation, do not mark
  down the run

## What changed because of this run

| Changed | Why |
|---|---|
| `audit-block` opening rule rewritten | it asserted a behaviour the data never carried |
| eval case 1 prompt now states the reading behaviour | the original left the answer genuinely underdetermined |
| `grader.md` gained a read-only section | the harness penalised obedience |
| `grader.md` gained a "when the skill itself is wrong" section | an eval that only grades runs will keep passing a canon that is quietly wrong |

## The point

Three cases found one wrong rule in canon and two wrong rules in the harness. None of the three
would have surfaced by reading the skill — they needed the skill to be *run* by something that had
never seen this codebase.

Next run should replace case 1 outright if both arms pass it by the same reasoning: a case both arms
get right the same way exercises nothing.
