---
title: Docs
---

# StarCi trust v3

Read this before planning, before reading target source, and before running a skill.

The tree is split by **what a stage is allowed to return**. That is the only classification here;
order follows from it rather than defining it.

| Tree | Returns | Read it when |
|---|---|---|
| [`contexts/`](./contexts) | where source is read from, where state is written | always first — nothing below is correct if the route is wrong |
| [`brainstorms/`](./brainstorms) | 3–4 candidates for the owner to choose | a surface or a block is not yet decided |
| [`compilers/`](./compilers) | exactly one answer, no candidates | a shape is accepted and code is about to be written — [`principles`](./compilers/principles) decide the classes, [`patterns`](./compilers/patterns) decide which file holds it and what it may import |
| [`gates/`](./gates) | pass, or reject with evidence | code exists and must be judged — [`lints`](./gates) point at the character they refuse on |

## Load order

**A skill owns its own reading list.** Its numbered steps name what to read and when. If a skill is
driving, follow the skill and stop reading here — this file has done its job by getting you to it, and
loading a stage the skill did not ask for is paying for a tree you are not using.

**If nothing is driving — plain coding, no skill —** this order is yours:

1. [`contexts/workspaces`](./contexts/workspaces) — resolve the project's role routes and **verify**
   them. A stale route stops the work; it is not approximated.
2. [`contexts/worktrees`](./contexts/worktrees) — only if the work writes state that must survive.
3. [`compilers/`](./compilers) — **before the first line**: [`principles`](./compilers/principles) for
   every class, [`patterns`](./compilers/patterns) for which file holds the code and what it may import.
   Both answer a shape already accepted, so reading them afterwards leaves only one move — moving code
   that is already written.
4. [`gates/`](./gates) — last, on code that exists.

[`brainstorms/`](./brainstorms) is deliberately absent from that list: if the shape is not decided,
coding has not started, and deciding it belongs to a skill — layout, then block.

Read [`skills/skill-shape`](./skills/skill-shape) when you are about to run a skill or write one, not
before every task.

A request that cannot resolve its project, its role targets or its write boundary is stuck before any
target-specific work. Say so; do not proceed on a guess.

## Capabilities

Seven. `skills/starci-*` holds them; `skills/skill-shape` holds what they must all print, ask and
record. Six do the work; the seventh only looks at the other six.

| Skill | Owns |
|---|---|
| `starci-init` | making a Source ready: the bootstrap, `.workspace/<project>/`, `.worktrees/<project>/` — three roots, approved separately |
| `starci-diagnose` | a read-only trace of another skill; writes nothing it traces |
| `starci-fe-design-layout` | layout candidates, hash-bound |
| `starci-fe-design-block` | block anatomies, hash-bound |
| `starci-fe-design-execute` | frontend source, only after every hash is accepted |
| `starci-be-plan` | the backend brief |
| `starci-be-approve` | approval, then backend source |

## What this tree refuses

The rules here are written to be **machine-refusable**, because a rule that only advises gets skipped
under pressure:

- a layout candidate is class-free, enforced by reading 38% of the contract — a stage that cannot see a
  class cannot write one;
- every schema sets `additionalProperties: false`, so a stray `className` is invalid rather than
  arguable;
- [`scripts/validate-artifact.mjs`](./scripts/validate-artifact.mjs) refuses a batch whose candidates
  share an axis set, or where none departs from precedent;
- the lint machines are real ESLint plugins, published from `starci183/starci-eslint` as
  `@starci/eslint-canon-fe` and `@starci/eslint-canon-be`, each rule shipped with the test that fires it.
  **This tree is the law; that repository is the machine.** A rule there with no law here is
  unaccountable; a law here with no rule there only advises;
- an approval binds to the hash of canonical JSON with the envelope outside it, so re-running the same
  decision yields the same hash.

## Authoring

Every module is one document in two records: `en.md` for the agent, `vi.md` for the human. They match
section for section and neither refers to the other. A shelf may carry its own `en.md`, which becomes
that shelf's page.

**One tier, two layouts.** A frontend is either **single-app**, keeping the component tree at
`src/components/*`, or a **monorepo**, keeping the same tree under the same tier names in a shared
package at `packages/ui/src/*`. The tier names never change; only the prefix does, and the prefix is a
closed list the machine holds — `src/components`, `packages/ui/src`, `src`.

So a rule writes the tier and not the prefix: `components/leaves/<Name>/index.tsx`. A rule that writes
the prefix by hand works in one repository and is **blind in the other** — and blind here is not noisy,
it is silently wrong in both directions at once: an unrecognised leaf gets reported for writing the
classes a leaf is supposed to write, while every rule guarding the leaf tier quietly stops guarding
anything. Measured once, pointed at a monorepo: 46 errors across 28 correct files, and the repository
owed none of them.

The machine does this without branching per layout, and the shape is worth copying: a predicate walks
the closed list and passes if **any** root matches; a path builder maps the list and emits **one
candidate per layout**; a resource that can be split — a theme stylesheet in a monorepo — has its own
candidate list, and every file found is read and joined rather than the first one winning. So a layout
added to the list is added to every rule at once, which is the whole reason there is one list instead
of an `if` per rule.

A monorepo also carries one law a single-app tree cannot have — `FILE-5`: a tier that knows a feature
belongs to the app that owns the feature, a tier that knows none belongs to the shared package. In a
single-app checkout that rule is **inert by its own regex**, which requires an `apps/<name>/src/` or
`packages/<name>/src/` segment — not disabled by configuration, so nobody has to remember to turn it
off and nobody can turn it on wrongly.

The exception is a rule describing **its own machine**: when a lint gates on a filename containing
`/src/tests/`, that string is the mechanism, not a layout claim, and it is quoted exactly.

**A law names a rule, never a rule's file.** The published rule name is the only identifier —
`@starci/eslint-canon-fe` and `@starci/eslint-canon-be` are where the implementations live, and how they
are arranged into files is the machine's business, not the law's.

Rules live in the tree. This file routes; it never restates a rule, and neither does the Source
bootstrap.
