---
name: starci-be-cannon-audit
description: Grades real backend source against the BE canon and returns a ranked report of every place the code and the canon disagree, each finding anchored to a file and line in the tree and to the canon rule it breaks — and it changes nothing. Reach for it whenever backend code needs to be judged rather than written: "audit this module", "how far off canon is this service", "review this branch against our backend rules", "check the resolvers before I merge", "soi code backend lệch chuẩn", "check pattern backend", "nghiệm thu module BE" — and also before editing an unfamiliar module, so the drift you are about to inherit is on the table before you add to it. Not for writing or repairing code: an approved finding is handed to starci-be-cannon-apply. Not for architecture or design review either, because the canon records how this backend already spells things, not what it should have been built out of.
---

# Auditing the backend against canon

The canon under `canon/be/` is not a wish list. Every rule in it names the file in `src/` it was
read from and the day it was counted, which is what makes it gradeable at all: a finding is not an
opinion about how the code should look, it is a disagreement between two things that can both be
opened.

That is also why this skill produces a report and no diff. A run that grades and edits in one pass
cannot be reviewed — by the time anyone reads the finding, the edit that justifies it already
exists, and there is no way left to tell which came first. **An audit reads and grades; it never
edits the tree it is grading.** The repair is a separate, approved act, and it belongs to
`starci-be-cannon-apply`.

## 1. Resolve the source before opening anything

The backend lives at a different absolute path on every machine, so nothing here remembers one.

```bash
node .claude/scripts/workspace/read-workspace-context.mjs be.path
```

A non-zero exit means this machine has never stated where its backend is; it prints the command
that fixes that. Honour the exit code rather than guessing — grading the wrong checkout produces a
report that is internally consistent and entirely fictional. The registration flow is
`skills/starci-setup-workspace-be`.

## 2. Fix the scope, and say what it is

Three scopes are worth auditing, and they answer different questions:

| Scope | When | How it is gathered |
|---|---|---|
| a module folder | "is this feature written the way the rest of the repo is" | every `.ts` under that folder in `be.path` |
| a change set | before a merge — the fastest useful audit | `git diff --name-only` against the base branch, read-only |
| a named rule across the tree | "does anything still throw a bare `Error`" | one grep, one shelf of canon |

State the scope at the top of the report. A reader who does not know what was looked at cannot
tell a clean module from a module nobody opened.

## 3. Read the shelf the scope touches — not the whole canon

`canon/be/INDEX.md` splits the rules into three shelves by the question each answers, and a rule
read out of its shelf gets applied where it does not belong.

| Shelf | Grade the scope against it when the code… |
|---|---|
| `canon/be/modules/modules-and-di.md` | declares a module, a provider, a resolver, a service or a CQRS handler |
| `canon/be/modules/database-and-entities.md` | declares an entity or writes a query |
| `canon/be/contracts/api-surface.md` | exposes a GraphQL leaf or a REST controller |
| `canon/be/contracts/validation.md` | accepts input at the boundary |
| `canon/be/contracts/exceptions.md` | throws anything at all |
| `canon/be/contracts/async-and-messaging.md` | enqueues work, consumes it, emits events, or schedules |
| `canon/be/conventions/type-safety.md` | types anything loosely, or types nothing |
| `canon/be/conventions/imports-and-format.md` | imports, formats, or barrels |
| `canon/be/conventions/comments.md` | comments |
| `canon/be/conventions/config-and-env.md` | reads configuration or a secret |

Most scopes cross all three shelves at once: `modules/` for the folder the code lives in,
`contracts/` for the surface it exposes, `conventions/` for how the resulting lines are typed.

## 4. Write findings that can be checked without you

A finding carries four parts, and one missing part makes it unusable:

1. **the rule** — canon file and the numbered heading inside it, e.g.
   `canon/be/contracts/exceptions.md` rule 2
2. **the anchor** — a real path under `be.path` and a real line number, plus the offending line
   quoted as it stands
3. **the severity** — see below
4. **the correction** — one sentence, and it must be the one the canon already prescribes, not a
   better idea you had while reading

Three severities, and the boundary between them is the canon's own wording:

| Severity | What it means | Typical |
|---|---|---|
| **blocking** | the canon states this as never or always, in those words | `throw new Error`, a framework `NotFoundException` under `src/modules/**`, a new `any`, `process.env` read outside `parse-env.ts`, business logic sitting in a resolver |
| **drift** | the canon prescribes a shape and the code took another one that still works | a module declared as a bare `@Module`, a service with an inferred return type, a relative climb where an alias exists |
| **note** | true, small, and cheap — worth saying once | a stale comment above a changed line, a barrel that has drifted |

Rank the report by severity, and inside a severity by how many places share the cause. Ten call
sites of one wrong helper are one finding with ten anchors, not ten findings.

## 5. Hand off, and leave the tree as you found it

Close the report with the blocking findings restated as a short list and ask which of them to
build. Approval is what turns a finding into work, and `starci-be-cannon-apply` is what does the
building.

Anything deliberately left undone gets recorded rather than remembered:

```bash
node .claude/scripts/record-technical-debt.mjs add \
  --role be --title "…" --why "…" --rule "<canon file + heading>" --path "<path under be.path>"
```

The ledger and its rules are `skills/starci-record-debt`. An unrecorded deferral reads to the next
person as code nobody ever looked at.

## What this audit refuses

**It grades only what the canon holds.** A pattern that looks wrong but that no rule covers is not
a finding. Put it in a short "proposed rules" section at the end of the report, phrased as a
proposal, and leave the count of findings untouched.

**It does not edit the canon.** Discovering that a rule is stale is a normal outcome — the source
wins, says `canon/be/INDEX.md` — but changing a rule has its own procedure in
`canon/HOW-TO-WRITE.md`, which starts by reading the source the rule describes and ends with
`scripts/verify.mjs`. Doing that mid-audit rewrites the ruler while measuring with it.

**It does not guess an anchor.** A rule you believe is broken but cannot point a line at goes in a
"needs verification" list. A confident finding with an invented line number costs more than the
silence it replaced.

**It does not grade taste.** Naming that reads oddly, a function someone would have split
differently, a folder that could be flatter — none of these are canon, and a report padded with
them trains readers to skim past the blocking findings.

## Files

| Path | What it is |
|---|---|
| `canon/be/INDEX.md` | the three shelves, and which question each answers |
| `canon/HOW-TO-WRITE.md` | what makes a rule a rule, and how one is changed |
| `.claude/scripts/workspace/read-workspace-context.mjs` | where the backend actually is on this machine |
| `.claude/scripts/record-technical-debt.mjs` | the ledger for what is knowingly left undone |
| `README.md` | why this skill is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-be-cannon-audit/test.mjs` |

The repair lane is `skills/starci-be-cannon-apply`. They read the same canon; only one of them
writes.
