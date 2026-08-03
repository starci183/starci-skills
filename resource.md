# resource.md — which model does which work, and when not to use one at all

This governs every task the suite runs, not one skill. It decides what runs where, so effort lands
where it changes the answer and nowhere else.

## The allocation

| Work | Runs on |
|---|---|
| **Thinking** — planning, writing a spec, deciding a design, finalizing, verifying a result | **Opus 4.8** (the main loop, the high tier) |
| **Writing** — authoring a doc, coding a file, writing a test, filling a template | **Sonnet 5** |

Opus decides and checks; Sonnet produces. A plan made on the cheap tier drifts; prose polished on the
expensive tier is money spent on typing.

## Prefer a Sonnet workflow for fan-out writing

When the writing is more than one file and the files are independent — a set of skills, a shelf of
canon, a batch of tests — do not author them one at a time on the main loop. Author a **Workflow**
whose write phase runs on **Sonnet**, and let Opus write the spec and verify the result. The main loop
stays the place decisions are made; the workflow is where they are typed out in parallel.

## Prefer a mechanical fix over a model

Before spawning any agent, ask whether the change is **deterministic**. A rename across files, a
path rewire, a git move, a find-and-replace, a count — these are `sed`, `git mv`, a script, run once,
correct every time. Spending a model on them is slower, costs tokens, and can hallucinate a change a
script would have made exactly. Reach for a model only when the change needs judgement a script cannot
encode.

The order to try, cheapest first: **a script or shell command → a Sonnet workflow → the main loop.**
Move up a rung only when the rung below cannot do the job.
