---
name: starci-repair
description: Take a source that no longer builds, no longer lints clean, or drifted out of format, and return it green — measured before and after with the repository's own gates, repaired in separated passes, and never made green by silencing a finding. Use when a checkout is red, when lint debt has piled up, or before trusting a repository nobody has run in a while. Writes product source, after approval.
---

# starci-repair

Read [`../skill-shape/en.md`](../skill-shape/en.md) first.

**Two different things are called stale, and repairing the wrong one wastes the run.**

| What is stale | Symptom | Owner |
|---|---|---|
| the **route** | the recorded checkout, contract or head no longer holds | [`starci-init`](../starci-init/SKILL.md) |
| the **source** | it does not build, does not lint clean, or drifted out of format | this skill |

So this skill resolves the route first and **stops** if the route is the stale thing. Repairing source
through a stale route means repairing a repository nobody asked about.

## The law this skill exists to protect

**Green is earned, never bought.** A finding is repaired or returned; it is never silenced. No
`eslint-disable`, no weakened severity, no rule removed from a config, no test skipped, no `any` added
to end a type error. Every one of those turns a red gate into a green one while leaving the defect in
place — and the next reader has no way to know it was ever there.

**Formatting is not repair, and mixing the two destroys review.** A behavioural fix inside four thousand
reformatted lines is a fix nobody can see. Format runs alone, in its own pass, with its own commit.

**Measure with the repository's own gates.** Read the manifest and run the scripts that repository
actually declares. A count from a command the project does not use proves nothing about the project.

## PROCESS

### 1 — Print CONTEXT

`Phase` is `plan`, then `review`, then `apply`. `Touching` is the workflow record until approval; after
approval it is the exact source paths the approved boundary names.

### 2 — Resolve and verify the route, and stop if the route is the problem

Read `.workspace/<project>/<role>/config.json` and verify it before reading source: the checkout exists,
the contract path for a frontend role exists, the recorded head still belongs to that checkout.

A stale route ends the run here and returns to `starci-init`. Say which field failed.

### 3 — Read the manifest before running anything

The gates are whatever this repository declares — not a remembered list. Read `package.json` and find
the scripts that exist: lint, typecheck, build, test. A repository with no `typecheck` script is not
failing a typecheck; it has none, and that is a finding for the plan rather than a command to invent.

**Do not run end-to-end suites** unless the request asked for them by name.

### 4 — Measure, and write the numbers down

Run each gate that exists, in the cheapest order — format check, lint, typecheck, build, unit tests —
and record the exact counts before touching anything: errors, warnings, failing suites, and the files
they land in.

This is the number the run will be judged against. A repair with no before-count is a claim.

### 5 — Classify every finding, because they do not have one fix

| Class | What it is | How it is repaired |
|---|---|---|
| `format` | whitespace, quotes, import order — the formatter's opinion | one mechanical pass, no reading required |
| `mechanical` | a fix the tool can make safely and the reader can verify by eye | autofix, then read the diff |
| `defect` | real broken behaviour, a wrong type, a dead import, a missing case | repaired by hand, one at a time |
| `decision` | the code is deliberate and the rule refuses it, or the rule and canon disagree | **returned to the owner** — the fix is a decision, not an edit |

A `decision` misfiled as a `defect` is how a rule gets bent to match the code. A `defect` misfiled as a
`decision` is how real breakage gets waved through as a matter of taste.

### 6 — Review: the counts, the classification, the boundary

Present the before-counts, the four classes with how many findings each holds, the exact file list, and
what the run will **not** touch. Batch every approval into one round.

Where a `decision` blocks a whole file, say so: it is better to hand back a file with a named question
than to return a repository that is green because one file was rewritten to somebody else's taste.

### 7 — Baseline, then repair in separated passes

Commit the current state and record `Baseline commit: <sha>` — before the first change, never from a
half-edited tree.

Then, in this order, each pass its own commit:

1. **format** — the formatter, alone. Nothing else in the commit.
2. **mechanical** — autofix, then read every hunk. An autofix that changed behaviour is a defect the
   tool introduced, and it is caught here or not at all.
3. **defects** — by hand, smallest first, re-running the gate that reported each one.

A pass that would need to weaken a gate stops and returns the boundary. Unrelated work in the tree is
preserved: this skill repairs what the gates named and nothing adjacent that caught the eye.

### 7b — Fan out the defect pass, and only that pass

Ten agents, and the assignment is **by file, never by rule**. Two agents holding one file will overwrite
each other's repair and the second one wins silently; two agents holding one rule across many files are
the same collision spread thinner.

**Two passes are never fanned out.** The formatter and the autofix are single whole-repository commands —
running them ten times concurrently produces ten writers on one file set. Only the `defect` pass, where
each finding is a separate hand repair in a separate file, is worth ten agents.

**Whole-repository gates run once, by the coordinator, never per agent.** Build output is shared state:
ten concurrent typechecks or builds in one checkout write the same `dist`, the same cache, the same
incremental info, and the failures they report are each other rather than the code. An agent may run a
**file-scoped** lint on the files it holds; nothing more.

Each agent returns what it repaired, what it refused and why. The coordinator re-measures — an agent's
own claim that its file is clean is not the measurement.

| Runtime | Model |
|---|---|
| Codex | Luna |
| Claude | Sonnet 5 |

That table is the owner's standing choice, not a benchmark result. A repair pass is many small
independent edits against a gate that answers yes or no, which is the shape a mid-tier model does well
and the reason the fan-out is worth its cost at all.

### 8 — Prove it with the same commands

Re-run the exact gates from step 4 and print before-and-after side by side. Zero errors means zero — not
zero after a disable, not zero because a rule was dropped, not zero because a test was skipped.

If a gate cannot pass without a decision the owner has not made, the run reports it as `OWED` with the
count that remains. **A partly repaired repository honestly reported is worth more than a green one that
lies.**

### 9 — Close the phase

Append the workflow with the applied revision, the baseline commit, the tracked diff and the two count
tables.

## Stops

- The route is stale → return to `starci-init`, naming the field that failed.
- A gate can only pass by silencing a finding → stop; that is the one thing this skill exists to refuse.
- A lint rule contradicts the canon it claims to enforce → stop; that is a trust-tree change, and
  `starci-diagnose` calls it a `defect` rather than an environment problem.
- The tree is already dirty with unrelated work → stop; a baseline taken from mixed state proves nothing
  and the diff will not be readable.
- A repository declares no gates at all → stop; there is nothing to measure, and inventing commands
  measures somebody else's project.

## OUTPUT

The six tables from the skill shape, in order. `OUTPUTS` carries the before-and-after counts per gate;
`CHANGES` names every path in each pass, and says which pass each belongs to; `NEED APPROVALS` carries
one row per `decision`; `WARNINGS` carries every autofix hunk that changed more than formatting;
`REJECTED` carries the owner's words on any repair they refused; `OWED` carries the findings still
standing and the exact command that reproduces them.
