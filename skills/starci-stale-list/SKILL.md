---
name: starci-stale-list
description: List every kind of staleness starci-repair distinguishes across the workspace — route, source-gate surface, contract index, lint machine, formatter, backend delivery assurance, retired structure and remnant — with current evidence and the owner that clears each. Reads declared gates but deliberately does not execute lint, typecheck, build or tests. Read-only — it reports and repairs nothing. Use before trusting one or more projects or when a repair needs a workspace-wide stale inventory.
---

# starci-stale-list

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@assurance-be` | `compilers/patterns/be/delivery-assurance` | module | defines the complete backend hook, CI, coverage, analysis, secret and deploy machine |
| `@export-state` | `scripts/export-console-state.mjs` | script | measure all read-only stale facts and declared gate surfaces |
| `@skill-shape` | `skills/skill-shape` | module | the shared reporting contract every skill reads |

## NESTED SKILLS

None. This skill reports ownership; it never invokes the named capability.

## Run

Read `@skill-shape` first.

Plan-only: **the moment a report repairs something, nobody can trust it as a measurement.** A route it
quietly refreshed reads as a route that was fine.

## The eight stale things, without turning the list into repair

Use the same taxonomy as `starci-repair`; a list with a smaller vocabulary hides work during handoff:

| What is stale | What this skill can measure | Cleared by |
|---|---|---|
| **route** | checkout, contract, branch and recorded head against filesystem and git | `starci-init` |
| **source** | which gate entrypoints the manifest declares; pass/fail remains explicitly unmeasured | `starci-repair`, after approval |
| **index** | contract `why` reasons that describe a shape instead of stating a need | `starci-repair`, the `why` pass |
| **machine** | published canon installed by package name, absent, or vendored | `starci-repair`, the machine pass |
| **formatter** | direct Prettier packages and first-party config, script, hook, CI or editor integration | `starci-repair`, the strict-fix pass |
| **assurance** | every local `ASSURANCE-*` fact for backend routes; required GitHub checks and secret values remain explicitly external | `starci-repair`, the assurance pass |
| **structure** | a `shells` tier under an accepted production component root, including an empty directory | `starci-repair`, the retired-structure pass |
| **remnant** | a nested `.claude/` in a routed checkout, with recursive and tracked-file counts | `starci-repair`, the remnant pass; tracked content returns to the owner |

**This skill measures seven and names the source boundary honestly.** It reads gate declarations but never
runs them. A typecheck writes its incremental file, a build writes `dist`, and ten projects scanned that
way is a report that changed every machine it measured. Lint alone would be safe to run, but a list that
reports lint and not typecheck implies the rest was checked, so the line is drawn at "nothing that
executes the project".

**The report says which layers ran.** A list that silently skipped the expensive layer reads as *nothing
else is wrong*, which is the one thing a report must never imply.

The machine layer is cheap and it decides whether the expensive layer would mean anything: a checkout that
does not install the rule packages reports zero lint errors because nothing was checked, and a checkout
importing a vendored copy reports against whatever the law was on the day it was copied. Either way a green
count is not evidence, so the machine is reported before any count is believed.

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

### 1 — Establish the context lock

`Phase` is `plan`. `Touching` is nothing — this skill writes no file at all unless
the reader asks for the list to be kept.

### 2 — Scan, with the tree's own script

```bash
node @export-state --stale
```

It reads every `.workspace/<project>/<role>/config.json`, verifies each against this disk and against git,
reads backend assurance against `@assurance-be`, and exits `1` when anything is stale — so the same
command works from a shell that checks rather than reads.

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
| `valid` | checkout, contract and head all still hold | nothing |

### 4 — Name the source gate surface without claiming a result

Read each routed checkout's manifest and list only the primary gate entrypoints it declares: format,
lint, typecheck, build and tests. `declared` is not `green`. A repository declaring no gate surface is a
finding owned by `starci-repair`; a repository omitting one particular command merely has no such command
and this skill does not invent it.

### 5 — Report the contract index beside the routes

For every role whose route names a contract, the scan parses it and reports four numbers: entries, page
keys, feature-prefixed keys, and how many reasons state a need rather than describe a shape.

None of that is a route problem, and refreshing a route fixes none of it. It is reported here because it
answers the same question a reader is actually asking — *can I design against this project today* — and
because the cost of finding out is a file read.

A page key is excluded from the feature-prefixed count on purpose: it is route-scoped by design and
generalising it would describe two routes with one key.

### 6 — Report the lint machine, because it decides whether a count would mean anything

One line per role: `installed`, `absent`, or `vendored` with the relative path the config imports. Anything
but `installed` carries its owner from the layer table and the reason, which is not
"a package is missing" but **"no count from this checkout is evidence"**: absent means nothing was checked,
vendored means it was checked against a private copy of the law.

### 7 — Measure backend delivery assurance as one indivisible machine

For every backend route, report every missing `ASSURANCE-*` fact: Husky and its check-only pre-push,
active PR CI, one LCOV-producing unit run, Codecov upload, SonarQube scan plus quality gate, encrypted
stack token records, symbolic workflow secret references and deploy dependency. Partial adoption is
stale; do not call one installed vendor a smaller profile.

Read only names and wiring. Never decrypt a stack record or print a provider value. Required GitHub
checks, expected-app binding and actual GitHub secret values are external facts; report them as
`unmeasured external` unless an authorized API supplies evidence.

### 8 — Measure formatter, retired structure and remnant directly

For formatter staleness, inspect only first-party integration points. A prose mention or a transitive
lockfile entry is not formatter ownership. For retired structure, inspect accepted production component
roots directly rather than searching tracked files: an empty `shells/` is stale and Git cannot see it.
Candidate and artifact trees are not production component roots.

For each nested `.claude/`, count files recursively and count tracked files separately. Never describe a
tracked remnant as safe to delete; `starci-repair` returns that decision to the owner.

### 9 — Separate the warnings that are not stale source

Two lists that should agree often do not: a project with a route and no worktree root can read source but
record nothing; a project with a worktree root and no route can record nothing about any source. Neither
is a stale route, and neither is repaired by refreshing one — they are reported under their own heading so
the fix is not confused with the route fix.

Every warning still names its owner. A missing worktree root is conditional setup, not source staleness;
an invalid route is not squeezed into `stale` or `absent`.

### 10 — Stop there

Say what is stale, why, and who clears it. Do not refresh a head, repoint a path or declare a contract:
each is outside this read-only run and requires its own approval. Doing it here would make this report the
thing that changed the machine it was measuring.

## Stops

- `.workspace` does not exist → stop; report that the Source has no routes and end this run.
- A route file is present but unparseable → report it as its own row. It is neither stale nor absent:
  it is invalid, and it fails differently.
- The reader asks for a fix → finish this report. A fix requires a separate owner request and run; do not
  start it from this skill.

## OUTPUT

Return every stale category, evidence and owner in concise prose, including clean or unmeasured wording
where silence would imply a check ran. For assurance, return secret names and encrypted-record presence,
never values. Scan every readable category before closing; ask only for a genuine authority boundary under
`### NEED APPROVALS`. No status tables.
