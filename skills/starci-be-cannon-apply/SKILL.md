---
name: starci-be-cannon-apply
description: Builds backend code that already obeys the BE canon — a new module, resolver, service, entity, handler or queue consumer written to the house spelling from the first line, or the approved findings of an audit turned into a real diff in the real tree — and self-checks the result against the same rules before it reports done. Reach for it whenever backend source is about to be written or repaired: "add a module for X", "write the resolver for this query", "make this service follow our patterns", "fix the blocking findings from the audit", "viết module BE chuẩn cannon", "sửa theo báo cáo audit", "apply code pattern backend", "chuẩn hoá module này". Not for judging code that already exists — that report comes from starci-be-cannon-audit and is what supplies the approved list. Not for front-end work, where a component reaches the app only after it has been a component and a story in the design system first (starci-setup-workspace-fe). Not for deciding what to build, only how the lines are written.
---

# Writing backend code that is already on canon

Drift is cheap to prevent and expensive to remove. A module written from the neighbouring module's
shape costs nothing extra on the day it is written; the same module written from memory and
corrected a week later costs a review, a diff, and a reader who has already copied the wrong shape
into somewhere else.

So this lane reads before it types. `canon/be/` records how this backend already spells things —
grounded in real `src/` files, not in preference — and the tree itself is the final authority when
the two disagree.

The second thing it does is refuse to move on its own. When the work comes from an audit,
**approval comes before the diff, never after it**: the findings that were approved get built, and
the tempting adjacent fix that nobody asked for does not.

## 1. Resolve the source

```bash
node .claude/scripts/workspace/read-workspace-context.mjs be.path
```

A non-zero exit means this machine has never stated where its backend is, and it prints the
command that fixes that; `skills/starci-setup-workspace-be` is the registration lane. Every path
below is relative to that answer. Writing into a remembered path is how a fix lands in a stale
worktree and passes every check in a tree nobody ships.

## 2. Read the shelf for what you are about to write

`canon/be/INDEX.md` splits the rules three ways. Open the ones the work touches, not the set:

| Writing… | Read |
|---|---|
| a module, provider, resolver, service, CQRS handler | `canon/be/explore/system-design/module-layering.md` |
| an entity, a column, a query | `canon/be/explore/system-design/data-access.md` |
| a GraphQL leaf or a REST controller | `canon/be/explore/system-design/api-design.md` |
| anything that accepts input | `canon/be/enforce/authoring/validation.md` |
| anything that throws | `canon/be/enforce/authoring/error-handling.md` |
| a queue, worker, event, cron or lock | `canon/be/explore/system-design/messaging-and-events.md` |
| any file at all | `canon/be/enforce/authoring/type-safety.md`, `canon/be/enforce/authoring/imports-and-format.md`, `canon/be/enforce/authoring/comments.md` |
| anything reading configuration or a secret | `canon/be/enforce/authoring/config-and-env.md` |

A new feature normally crosses all three shelves: the folder it lives in, the surface it exposes,
and how the resulting lines are typed.

## 3. Then read two real neighbours

Canon is a record, and a record lags. Before writing a file of kind X, open the two nearest
existing files of kind X under `be.path` and copy their folder layout, suffixes, import order and
naming. Where a neighbour and the canon disagree, the source wins — and that disagreement is worth
saying out loud in the summary, because it is usually a rule that has gone stale.

This is the step that gets skipped under time pressure, and skipping it is what produces code that
is defensible rule by rule and still reads as foreign next to its siblings.

## 4. Write it

Decide before typing: which files, which layer each belongs to, what the request and response
types are called, how the module is wired in. Then write, holding to the shapes the shelf
prescribes — the module definition, the thin resolver, the handler that carries the logic,
constructor injection, the exception class that extends the house base, the DTO that validates at
the boundary.

Two habits do most of the work here. One file holds one concern. A type, an enum or a helper that
more than one file needs lives in its own file rather than being exported sideways out of the one
that happened to need it first.

## 5. Self-check the diff you just wrote

Run the audit's own checklist over your own change before reporting done — same shelves, same
severities, and treat a blocking finding of your own making as unfinished work rather than as a
note. `skills/starci-be-cannon-audit` describes what counts as a finding and how it is anchored.

The questions that catch the most: is there a layer violation; does any error path throw something
that is not a canon exception; did an inline object type slip into a generic; is any new `any`
present; is `process.env` read outside its one permitted file; does every exported member carry the
documentation the conventions shelf asks for; do imports go through the aliases.

## 6. Let the machine check what a machine can check

```bash
npx tsc --noEmit          # in be.path
npm run lint              # in be.path
```

Record the failure count before your change so the pre-existing baseline is not mistaken for
damage you caused. Type checking is deliberately not wired into the build here, which makes
running it by hand the only thing standing between a type error and a deploy. New failures are
yours; clear them before reporting.

## What this lane refuses

**It does not break a rule quietly.** A canon rule that genuinely does not fit the case at hand is
a conversation, not a judgement call: say which rule, why the case is different, and wait. A
silent exception becomes precedent the next time somebody greps for how this is done.

**It does not edit the canon to match the code it just wrote.** That inverts the whole
arrangement. A rule changes through `canon/HOW-TO-WRITE.md` — read the source first, change the
rule, the anchor and the date together, then `scripts/verify.mjs` — and never in the same breath
as the code that would benefit from the change.

**It does not widen the scope on its own.** Adjacent drift noticed while working is either
approved as extra work or recorded:

```bash
node .claude/scripts/record-technical-debt.mjs add \
  --role be --title "…" --why "…" --rule "<canon file + heading>" --path "<path under be.path>"
```

The ledger and its rules are `skills/starci-record-debt`.

**It does not report done on a self-check it did not run.** A summary that lists the files
created and claims the checks passed, when the checks were never executed, is worse than no
summary — it spends the reviewer's trust on nothing.

## Files

| Path | What it is |
|---|---|
| `canon/be/INDEX.md` | the three shelves, and which question each answers |
| `canon/HOW-TO-WRITE.md` | what makes a rule a rule, and how one is changed |
| `.claude/scripts/workspace/read-workspace-context.mjs` | where the backend actually is on this machine |
| `.claude/scripts/record-technical-debt.mjs` | the ledger for what is knowingly left undone |
| `README.md` | why this skill is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-be-cannon-apply/test.mjs` |

The grading lane is `skills/starci-be-cannon-audit`. They read the same canon; only this one
writes.
