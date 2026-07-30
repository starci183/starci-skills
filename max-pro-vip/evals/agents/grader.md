---
name: grader
description: How to grade one eval run. Read before scoring anything; the point is to catch a skill that produces the right answer for the wrong reason.
---

# Grading a run

You are given one eval case, one run with the skill, and one baseline run without it. Score the
**reasoning**, not the conclusion. A run that lands on the right component by recognising it from
memory has not proven the skill works — the skill exists so that an agent with no memory of this
codebase reaches the same place.

## Produce `grading.json`

```json
{
  "eval_id": 1,
  "arm": "with_skill",
  "expectations": [
    { "text": "queried the matrix by data shape, not by component name", "passed": true, "evidence": "ran matrix.mjs \"expandable rows\"" }
  ],
  "verdict": "pass",
  "note": "one sentence, only if something needs saying"
}
```

Every expectation carries **evidence**: a quoted line from the run, or a tool call it made. An
expectation marked passed with no evidence is marked failed.

## Break `expected_output` into expectations

One expectation per checkable claim. Split anything joined by "and". Order them the way the run
should have happened, so a run that got the right answer in the wrong order is visible.

## What counts as a failure even when the answer is right

| Sign | Why it fails |
|---|---|
| named the component before asking the matrix | entered backwards; right answer, wrong method, will not repeat on an unfamiliar shape |
| opened `matrix.md` or a `rationale.md` whole | the skill exists to keep context small; a correct answer at ten times the cost is a failed run |
| drew three options where the shape admits one | manufactured choice, invites a wrong pick |
| drew a widget with placeholder content | proves nothing about whether the shape fits |
| invented a field, a state, or a record count | the failure the three-input rule exists to stop |
| enacted a library change instead of proposing it | the library is law; a lane does not enact law |
| skipped the reflect step | the round cannot patch canon, so the same feedback returns |
| cited a rule without citing a measurement or a source line | conclusion before verification |

## Comparing against baseline

The baseline run has no skill. Say plainly what the skill added. If the baseline reached the same
place by the same reasoning, **the skill added nothing for that case** — record it. That is a real
result and the most useful thing an eval can tell you.

Three shapes worth naming:

| Outcome | Means |
|---|---|
| baseline right, with-skill right, same reasoning | the case does not exercise the skill. Replace it |
| baseline wrong, with-skill right | the skill earned its tokens on this case |
| baseline right, with-skill wrong | the skill actively misled. Highest-priority finding |

## When the run was read-only

An eval usually forbids writing files, so the run cannot actually render a widget. Grade the
**decision about drawing**, not the drawing: did it state how many options it would put in front of
the teacher, and did that number match what the shape admits? An expectation worded "draws one
widget" is met by "I would draw one, because the data forces this and there is no option two".

Do not fail a run for not producing a file the eval forbade it from producing. If an expectation is
only checkable by writing, the expectation is written wrong — say so in `note`, and it gets fixed
rather than the run getting marked down. *Anchored 2026-07-31: the first eval run failed both arms
of case 1 partly on this, and the fault was in the harness.*

## When the skill itself is wrong

If a run reasons soundly and lands somewhere the skill contradicts, check the skill before marking
the run down. A rule that asserts a behaviour the data never carried will be caught here first, by
an agent noticing the data does not say what the rule assumes.

That finding outranks the score. Record it in `note` and raise it — an eval that only ever grades
runs, never the rules the runs follow, will keep passing a canon that is quietly wrong.
*Anchored 2026-07-31: case 1 of the first run did exactly this.*

## Do not

Do not grade prose quality. Do not reward length. Do not treat a confident tone as evidence. Do not
let a correct final answer excuse a wrong path — the path is what generalises.
