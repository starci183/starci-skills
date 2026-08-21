---
name: starci-diagnose
description: Trace another skill's flow against the real machine without running it — step by step, naming what each step would read, what is actually there, and where the run would stop. Separates "the environment is not ready" from "the skill is defective". Use before trusting a skill in a new project, after changing the tree, or when a skill stops and it is unclear whether that was correct. Writes a report and nothing else.
---

# starci-diagnose

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | the shared reporting contract every skill reads |

## NESTED SKILLS

None. This skill never invokes another skill.


## Run

Read `@skill-shape` first.

Invoked as `/starci-diagnose <skill>` with an optional scenario:

```text
/starci-diagnose <skill>
/starci-diagnose <skill>  render the settings page at second-app
```

Without a scenario it traces what every run of that skill needs. With one, it traces that run.

## The law this skill exists to protect

**A trace performs no step it is tracing.** It reads, resolves, checks and measures; it never writes a
registry, never opens a review round, never commits a baseline. The moment a diagnosis writes anything the
target skill would write, it has stopped being a diagnosis and become an unapproved run.

**A stop is not a defect.** These are two different findings and conflating them is the failure this
skill exists to prevent:

| Finding | Means | Fixed by |
|---|---|---|
| `blocked` | the skill would stop, correctly — the machine is not ready | another skill, or a decision from the owner |
| `defect` | the skill points at something that does not exist, contradicts a law, or names a step nobody can execute | a change to the trust tree |

Reporting a correct stop as a defect sends someone to rewrite a working rule. Excusing a defect as
"environment not ready" leaves the rule broken and blames the machine. Every finding carries one of the
two labels and the evidence that earned it.

**A step that cannot be evaluated without writing is `cannot-tell`, never `pass`.** Some steps only
reveal themselves by running — whether a validator accepts a batch that does not exist yet, whether a
host builds. Say so. A trace that reports `pass` on a step it could not reach is worse than no trace,
because it retires a doubt that was still true.

## PROCESS

### 1 — Establish the context lock

`Phase` is `plan`. `Touching` is `None`. A diagnosis that writes anywhere else has
broken its own law.

### 2 — Read the target skill, and take its steps literally

Read the named `SKILL.md` whole. Its numbered steps are the trace's own agenda: same order, same
numbers, no step merged and none skipped. If a step is ambiguous about what it reads, that ambiguity is
itself a `defect` — a step nobody can evaluate is a step nobody can follow.

### 3 — Resolve the environment the same way the skill would

Walk the same route the skill walks: the workspace route for its role, the worktree roots, the entry
files, the contract, the vocabulary, the scripts it invokes. Use the same resolution order, because a
skill that stops at step 2 never reaches the problem at step 6 — and reporting step 6 first tells the
owner to fix the wrong thing.

### 4 — Evaluate each step, in order, until the first stop

Per step: what it reads, what is actually there, and one verdict.

| Verdict | When |
|---|---|
| `pass` | the step's inputs exist and satisfy what it requires |
| `would-stop` | the step's own stop condition fires |
| `cannot-tell` | the step can only be evaluated by performing it |
| `defect` | the step names something absent from this tree, or contradicts a law in it |

**The first `would-stop` is the answer to the question asked.** Keep tracing past it — the later steps
still reveal defects worth knowing — but say plainly which stop the run would actually hit, and do not
present a step-9 problem as if it were the blocker.

### 5 — Look one step deeper than the stop

A stop usually hides a bigger question. The route file is missing, so the run stops — but would the run
have worked if the route existed? Check the inputs the next steps need, and report what would still be
missing after the obvious fix. Otherwise the owner clears the stop, runs again, and hits a second wall
that was visible all along.

### 6 — Check the scripts and paths the skill names

Every command, script and file a step names is resolved. A skill that invokes a script this tree does
not contain is a `defect`, however sensible the sentence around it reads.

### 7 — Close the phase

Summarise the first stop and every `cannot-tell` in friendly prose. Exhaust every readable trace step
before closing; do not turn incomplete diagnosis work into an owed list.

## Stops

- The named skill does not exist → stop; list the skills that do rather than guessing which was meant.
- The trace cannot proceed without writing → stop at that step and mark it `cannot-tell`.
- The decision registry is missing, so a hash-bound design record has nowhere to land → say so in prose
  and record the step as not evaluated.

## Worked example

**Invocation.** `/starci-diagnose <skill>  render the settings page at second-app`

### What the trace does, step by step

| Target step | What it reads | What is there | Verdict |
|---|---|---|---|
| 1 establish context lock | — | — | `pass` |
| 2 resolve + verify the `fe` route | `.workspace/second-app/fe/config.json` | `.workspace/` holds `example-app` only; no `second-app` | **`would-stop`** — `WORKSPACE-2` |
| 3 worktree roots | `.worktrees/second-app/{businesses,cache}` | absent, as expected without a route | `blocked` behind step 2 |
| 4 open or resume review work | the registry | unreachable | `blocked` behind step 3 |
| 5 read the six inputs | the contract at `context.contract` | **that checkout has no `components/contracts` directory** | `defect` in the *environment*, not the skill |
| 6 per-region verdicts | contract keys by `why` | no contract to search, so every region would resolve `new` | `blocked` by step 5 |
| 7–11 | — | not reached | `cannot-tell` |

### The findings, labelled

```text
finding: no workspace route for this project
label: blocked
evidence: .workspace/ contains example-app; second-app absent
first-stop: yes, at target step 2
cleared-by: the route owner, with the project declared by the owner
```

```text
finding: the project has no contract registry
label: blocked
evidence: the checkout exists on disk, but apps/app/src/components/contracts does not
after-the-obvious-fix: still blocked — input 2 of step 5 is the contract, and with none present every
region resolves `new`, which is the invented-entry failure the layout law names
cleared-by: an architecture decision by the owner, not a setup step
```

```text
finding: the requested surface has no source in the searched app
label: cannot-tell
evidence: searching apps/app/src for *vocab* and *defense* returns nothing
settled-by: the owner naming which app or package holds it, or confirming it does not exist yet
```

```text
finding: a design task attempts to resume another task's expired cache pack
label: blocked
evidence: no session pack under <Source>/.worktrees/<project>/cache/design/
cleared-by: regenerate candidates from current business authority, grammar, contract and source in the new invocation
```

### What the trace does NOT do

It does not create the route, does not open review work, does not write authority, and does not generate
a single candidate — even though step 2's fix is one skill away and the temptation to "just set it up
while we are here" is exactly how a diagnosis becomes an unapproved run.

### What the owner learns from it

The run would stop at **step 2**, and that stop is the tree working, not failing. But clearing it is not
enough: **the deeper blocker is that this project has no contract**, and that is a decision rather than a
setup command. The trace proves environment blockers; it does not invent a trust-tree defect where the
named validator exists.

## OUTPUT

Return the first stop, evidence and verdicts in concise prose. Ask only when the trace exposes a genuine
owner decision, under `### NEED APPROVALS`; this read-only skill never writes a repair itself.
