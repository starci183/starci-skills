---
name: starci-stale
description: List every project in the workspace that is not in a state you can trust to work in — routes that no longer describe this machine, and contract reasons no lookup can find — with the reason for each and the skill that clears it. Deliberately does not run lint, typecheck or build: those execute the project and belong to starci-repair. Read-only — it reports and repairs nothing. Use at the start of a session, before trusting a project you have not touched in a while, or when a run stops on a route and you want to know what else is in the same state.
---

# starci-stale

Read [`../skill-shape/en.md`](../skill-shape/en.md) first.

Plan-only, like [`starci-diagnose`](../starci-diagnose/SKILL.md) and for the same reason: **the moment a
report repairs something, nobody can trust it as a measurement.** A route it quietly refreshed reads as a
route that was fine.

## Three layers, and the cost is why they are not one

"Is this project stale" is not one question. Three layers answer it, they cost wildly different amounts,
and each has a different owner:

| Layer | Measured by | Cost | Cleared by |
|---|---|---|---|
| **route** | filesystem and git — does the recorded checkout, head and contract still hold | instant | `starci-init` |
| **contract index** | parsing the entry table — how many reasons state a need instead of describing a shape | instant | `starci-repair`, the `why` pass |
| **gates** | the repository's own lint, typecheck, build and tests | minutes per project, **and writes build output** | `starci-repair` |

**This skill runs the first two and refuses the third.** A typecheck writes its incremental file, a build
writes `dist`, and ten projects scanned that way is a report that changed every machine it measured. Lint
alone would be safe to run, but a list that reports lint and not typecheck implies the rest was checked —
so the line is drawn at "nothing that executes the project".

**The report says which layers ran.** A list that silently skipped the expensive layer reads as *nothing
else is wrong*, which is the one thing a report must never imply.

Measured on this machine: 5 routes across 3 projects, 3 stale; and one contract with 299 entries whose
reasons are 1 need against 298 descriptions. Both numbers came out of the two cheap layers — neither
needed a build.

## The law this skill exists to protect

**Stale is not broken, and the difference is who fixes it.** A stale route is a machine fact — a checkout
moved, a head advanced, a contract was never declared. Nothing in the source is wrong, and repairing
source through it would repair a repository nobody asked about.

**Every reason carries its owner.** A list of problems with no owner is a list nobody acts on, and
guessing the owner is how a route problem gets sent to a repair run. Each row names the skill that clears
it and what it will do there.

**Absent and stale are different verdicts.** A route that does not exist forces a question; a route that
exists and lies invites a confident wrong answer. They are reported apart because they are fixed apart.

## PROCESS

### 1 — Print CONTEXT

`Phase` is `plan`. `Touching` is nothing — this skill writes no file, not even the workflow record unless
the reader asks for the list to be kept.

### 2 — Scan, with the tree's own script

```bash
node <trust>/scripts/export-console-state.mjs --stale
```

It reads every `.workspace/<project>/<role>/config.json`, verifies each against this disk and against git,
and exits `1` when anything is stale — so the same command works from a shell that checks rather than
reads.

Do not re-implement the scan in conversation. The script is the measurement; a second reading of the same
files is a second answer nobody reconciles.

### 3 — Report by project, not by role

A reader asks "which projects can I work in today", so the rollup is per project with its failing roles
underneath. A project with one stale role is not a healthy project — it is a project with a hole in a
known place.

Three verdicts appear, and they are not the same news:

| Verdict | What happened | Cleared by |
|---|---|---|
| `stale` | the route is well formed and no longer true — a moved checkout, an advanced head, an undeclared contract | `starci-init`, per role |
| `absent` | the role has no route on this machine | `starci-init`, and the project must be declared first |
| `ok` | checkout, contract and head all still hold | nothing |

### 3b — Report the contract index beside the routes

For every role whose route names a contract, the scan parses it and reports four numbers: entries, page
keys, feature-prefixed keys, and how many reasons state a need rather than describe a shape.

None of that is a route problem, and refreshing a route fixes none of it. It is reported here because it
answers the same question a reader is actually asking — *can I design against this project today* — and
because the cost of finding out is a file read.

A page key is excluded from the feature-prefixed count on purpose: it is route-scoped by design and
generalising it would describe two routes with one key.

### 4 — Separate the warnings that are not routes

Two lists that should agree often do not: a project with a route and no worktree root can read source but
record nothing; a project with a worktree root and no route can record nothing about any source. Neither
is a stale route, and neither is repaired by refreshing one — they are reported under their own heading so
the fix is not confused with the route fix.

A missing workflow root belongs in that same list: every skill's `Touching` names a path under it, so its
absence blocks every capability equally and is nobody's route problem.

### 5 — Stop there

Say what is stale, why, and who clears it. Do not refresh a head, do not repoint a path, do not declare a
contract — each is `starci-init`'s work behind its own approval, and doing it here would make this report
the thing that changed the machine it was measuring.

## Stops

- `.workspace` does not exist → say so plainly; the Source has no routes at all, which is
  `starci-init`'s first run rather than a stale list.
- A route file is present but unparseable → report it as its own row. It is neither stale nor absent:
  it is invalid, and it fails differently.
- The reader asks for a fix → hand over to `starci-init` with the rows already measured, so the verdict
  arrives cheap.

## OUTPUT

The six tables from the skill shape, in order. `OUTPUTS` carries the rollup — projects, their stale roles,
and the count of clean routes; `CHANGES` is `None`, always, and a run where it is not is a failed run;
`NEED APPROVALS` is `None` unless the reader asked for a repair, in which case it is the handover;
`WARNINGS` carries the non-route findings; `OWED` carries any route the scan could not verify and the
reason it could not.
