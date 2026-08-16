# proof

A gate is only as good as its ability to reproduce work somebody already trusts. A proof is one
held-out test: a business requirement in, the real structure as the assertion, and what the gate
actually produced when it could not see the answer.

Proofs live at `fe/<shelf>/proofs/`, one file per tested screen, plus an `INDEX.md` holding the score
table.

## The method

1. Pick a screen the founder is confident is right. A screen nobody vouches for is not a standard;
   reproducing it proves only that the gate copies whatever happened.
2. One agent reads the real code and writes two things kept strictly apart: the **requirement** as it
   would have been stated before the screen existed, and the **expected output** at each gate.
3. Other agents run the gates. They may read the gate — including `example.md` — and they may not
   read the app. Each gate receives only the previous gate's output.
4. Score at **every boundary**, not only at the end.

### Writing the requirement

This is the part that decides whether the test means anything. The requirement may name who the user
is, what they came to do, what business data exists and what constraints apply. It may not name a
component, a file, an archetype, a class, a breakpoint, a state or a contract key.

The check: if the sentence has already revealed *"there is a rail on the right"* or *"four tabs"*,
it is written wrong. Rewrite it.

### When the blind agent does not know

Read the gate's `example.md` first. If the gate is still silent, **record it and move on with a
stated temporary choice**. Do not guess quietly. A line saying *"the gate does not say which side the
rail is on, so I chose left"* is worth more than a confident answer, because it points at the
sentence the gate is missing. Inventing a law that is not in the gate is the worse failure.

## The file

```
---
id: fe-<shelf>-proof-<page>
title: <page>
slug: /fe/<shelf>/proofs/<page>
sidebar_label: <page>
description: <one Vietnamese sentence>
---

# <page> · gate <shelf>

> Ngày: <date> · Chuỗi: layouts → blocks → principles → patterns → lints

## IN
## EXPECTED OUT
## ACTUAL OUT
## CHẤM
## GATE THIẾU GÌ
## GATE IM LẶNG Ở ĐÂU
```

`IN` is what this gate received, verbatim. `EXPECTED OUT` is read from the real code and anchored
`file:line` — it is the assertion. `ACTUAL OUT` lists all 3–4 candidates for `layouts` and `blocks`,
marking both the recommended one and the closest one; the other three gates carry a single answer.

## Scoring

Four verdicts per row:

| | |
|---|---|
| **TRÚNG** | matched |
| **LỆCH** | differed, and the difference is wrong |
| **KHÁC MÀ ĐƯỢC** | differed, and the requirement genuinely allowed both |
| **THIẾU** | said nothing about it |

**The third verdict is the one that keeps the test honest.** Without it every legal alternative
scores as a failure, the gate gets patched with rules that are too tight, and the next run can only
produce one shape.

### Candidate gates score twice

`layouts` and `blocks` return several options, so a single number hides the thing worth knowing:

- **best-of-set** — how close the nearest of the 3–4 came
- **recommended** — whether the one it preferred was that nearest one

A gate that produced the right option and preferred the wrong one is missing a **priority** rule, and
that is a small repair. A gate that produced no right option at all is missing knowledge that the
shape exists, and that is a large one. Read best-of-set first.

### Root fault and inherited fault

A gate that picks the wrong archetype makes every gate after it wrong. Those are consequences, not
faults. Score each gate against **the input it actually received**, and carry a column saying whether
a miss is root or inherited.

Skip this and every failure collects at the last gate, which is how a team ends up repairing `lints`
when the fault was in `layouts`.

## What a proof produces

Each file ends with two sections that are the reason the exercise is worth running.

**`GATE THIẾU GÌ`** — for each `LỆCH` and `THIẾU`, the sentence that would have prevented it, written
as a law rather than as a note. This is where the next version of the shelf comes from.

**`GATE IM LẶNG Ở ĐÂU`** — the blind agent's recorded uncertainty, verbatim. A question several
screens all had to guess at is the gate's loudest silence, and it outranks any single wrong answer.

Each entry is then classified: **the gate was silent** — write a rule; or **the requirement was
silent** — add a question the gate asks back. Writing a rule for the second kind is how a gate stops
being honestly stuck and starts being confidently wrong.
