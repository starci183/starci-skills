---
name: optimize-plan
description: What to do next, and what to stop doing. Written after a critique that the bundle was built by reacting rather than by measuring. Read before changing anything structural.
written: 2026-07-31
---

# Optimize

## The critique this answers

The bundle was assembled inside a single session by reacting to each request in turn. Evidence,
from that session alone:

| Thing | Times it changed | Driven by |
|---|---:|---|
| number of lanes | 3 → 4 → 6 → 2 | a sentence each time |
| `SKILL.md` ceiling | 500 words → 700 words → dropped, count lines | one invented, one measured |
| axis structure | 15 → 3 groups → 17 rules + 15 sheets | one measured, one requested |
| language | Vietnamese → English mid-way | a sentence |

The architecture is therefore a product of **the order the questions arrived**, not of the problem.
A rulebook must not depend on the order someone interrogates it.

The distinction that matters is not "reacting" versus "designing" — every good skill set is
distilled from real work. It is this:

> Acting on a request without measuring is reaction. Acting, then measuring, then keeping what the
> measurement supports, is learning.

Where this bundle measured, it holds: 103 rules classified by enforcer, five of six foundations
carrying a colliding-token pair, a baseline scoring 0/3. Those numbers do not move when someone
changes their mind. Where it only listened, it is soft: lane count, ceilings, names.

## The governing rule for everything below

**Every change from here carries a number, before and after.** A change with only a sentence behind
it does not ship. This applies to changes requested in conversation exactly as much as to changes
proposed here — that is the whole point.

## Baseline, measured 2026-07-31

| Metric | Now |
|---|---|
| `teacher` mentions | 159 across 44 files |
| library entries | 6 foundations · **0 atoms · 0 frames · 0 composites** |
| eval | 3 cases run · with-skill 2/3 · baseline 0/3 |
| `SKILL.md` size | 150 and 133 lines, ceiling 500 |
| judgement rules | 17 |
| decision sheets | 15 |
| API backlog | 96 items |
| validate checks | 6 tiers, 64 markdown files clean |

---

## Phase 0 — Freeze

Nothing structural changes until an unfreeze condition is met. Frozen:

- the number of lanes
- lane names
- the three-tier split: `judgement` / `decisions` / `axis-notes`
- every ceiling
- the folder layout

**Unfreeze condition, whichever comes first:** twenty library entries admitted, or two eval
iterations completed. Not a date, and not a request.

The freeze exists because the last four structural changes each cost a full rewrite of the pointers
between files, and none of them were caused by a measurement.

**Done when:** this section exists and the next structural change cites its unfreeze condition.

## Phase 1 — Strip authority from the instruction layer

159 mentions of `teacher`. They are correct in two places and wrong in the others.

| Layer | Mentions | Verdict |
|---|---:|---|
| `axis-notes/` · `docs/` | ~70 | **keep** — there, who decided and when *is* the content |
| `skills/` · `principles/` · `library/matrix.md` · core `references/` | ~89 | **strip** |

A rule that stands on authority cannot travel: an agent must trust a person it has never met, and
the rule collapses the moment that person is out of context. The same rule stated as consequence
stands on its own — the reader does not have to trust anyone, only to not want the outcome repeated.

| Instead of | Write |
|---|---|
| the teacher settled that `wrap` is not a breakpoint | `wrap` carries no threshold. Two screens shipped with their columns glued together at every width, mobile included, and nothing showed a defect until someone measured |
| the teacher's rule: brainstorm on vague critique | Vague critique means no fixed picture yet. Build two or three concrete options and let the picture do the asking |

Then add a `validate.mjs` check: the word is **forbidden** under `skills/`, `principles/`, and
`library/`, allowed under `axis-notes/`, `docs/` and `evals/`.

**Done when:** the count under the instruction layer is 0, enforced by the gate rather than by
intent. Target: 159 → ~70, all of them historical.

## Phase 2 — Fill the library, atom tier

`0 atoms` is the load-bearing hole. Every lane routes through `registry.json`; `lookup.mjs`
currently answers almost nothing. The architecture is a claim until this is done.

Source: 32 component notes in the private canon repo. Same treatment as the foundations pass, which
found that **half the notes were rulings, not entries** — expect the same ratio and do not assume a
note in a folder called `components/` defines a component.

Each entry must carry: role · API · full state set (absent states written as absent, with a reason)
· skeleton · tokens only · forbidden · a verdict on all 15 axes.

**Done when:** 20 atoms admitted, `lookup.mjs --missing` returns clean, and the triage document
records what was redirected and why.

## Phase 3 — Gate the output, not just the canon

`validate.mjs` guards the documents. Nothing guards a lane's **verdict**. The first eval showed the
gap: a run that cites no measurement, or does not say how many options it would draw, passes
unnoticed.

Write `scripts/verdict.mjs`, checking a session log for:

- every verdict cites a number, a source line, or a tool call
- a `grit` verdict names the token it should have used
- a `library gap` verdict states the proposed entry, and states that it was **not** enacted
- the option count is stated, and matches what the shape admits

**Done when:** the script rejects a hand-written bad verdict and accepts the two real rounds already
on record.

## Phase 4 — Eval iteration 2, cases chosen by someone else

The first iteration was written, graded, and case-selected by the same author. Case 1 caught a wrong
rule by luck: it was picked because it looked easy.

- keep the three cases that ran; replace any where both arms passed by the same reasoning
- add three cases chosen by someone who did not write the skills
- run both arms in the same turn, grade blind against written expectations
- compare against iteration 1 and record what moved

**Done when:** six cases graded, and every case where the skill added nothing is either replaced or
recorded as such.

## Phase 5 — Run for real, and change nothing

Two weeks of actual work through the two lanes. Log findings; **do not patch canon during the
window.** A canon patched while it is being tested is a canon that is never tested.

At the end, one synthesis pass: which rules fired, which never fired, which were worked around.

**A rule that never fired in two weeks of real use is a candidate for deletion**, not a rule that
proved itself by being quiet.

**Done when:** the log exists and the synthesis is written.

---

## Order

```
0 freeze ──► 1 strip authority ──► 2 fill atoms ──► 3 gate verdicts ──► 4 eval 2 ──► 5 run for real
              (measurable, small)   (the real hole)   (needs 2 done)   (needs outside help)
```

Phases 1 and 3 are mechanical. Phase 2 is the largest and the most valuable. Phase 4 needs a person
who did not write this. Phase 5 needs patience, which is the scarcest of the four.

## Not doing

**Not rewriting the bundle to be "properly designed."** That would be one more reaction, this time
to the critique itself, and it would discard the parts that measurement already supports.

**Not adding a lane, an axis, or a concept.** The failure mode of this bundle is growth by request.

**Not moving `example.html` yet.** It is misfiled under `references/` when it belongs in `assets/`,
and that is real — but it is a structural change, and the freeze covers it. It goes in the batch
after the first unfreeze.

**Not reporting that a phase is done because its files exist.** Each phase has a number attached.
